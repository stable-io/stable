import { before, describe, test } from "node:test";
import assert from "node:assert";

import type {
  KeyPairSigner,
  Blockhash,
  Instruction,
} from "@solana/kit";
import {
  pipe,
  generateKeyPairSigner,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  appendTransactionMessageInstructions,
  setTransactionMessageLifetimeUsingBlockhash,
  compileTransaction,
  signTransaction,
} from "@solana/kit";
// import { stringifyJsonWithBigints } from "@solana/rpc-spec-types";
// import { createHttpTransport } from "@solana/rpc-transport-http";
import { serialize } from "binary-layout";

import { Conversion } from "@stable-io/amount";
import { range } from "@stable-io/map-utils";
import {
  Byte,
  byte,
  genericGasToken,
  EvmGasToken,
  evmGasToken,
  Gas,
  gas,
  percentage,
  Sol,
  sol,
  usdc,
  mulPercentage,
} from "@stable-io/cctp-sdk-definitions";
import type { Seeds, SolanaAddressish } from "@stable-io/cctp-sdk-solana";
import {
  SolanaAddress,
  findPda,
  minimumBalanceForRentExemption,
} from "@stable-io/cctp-sdk-solana";
import { feeAdjustmentTypes } from "@stable-io/cctp-sdk-cctpr-definitions";
import { CctpRGovernance, CctpR, CctpRReclaim, oracle } from "@stable-io/cctp-sdk-cctpr-solana";

import { createForkSvm } from "./forkSvm/index.js";
import {
  FailedTransactionMetadata,
  TransactionMetadata,
} from "./forkSvm/liteSvm/internal.js";

type Ix = Required<Instruction>;

const soPath = (name: string) => `target/sbpf-solana-solana/release/${name}.so`;
const solAddr = (addr: SolanaAddressish) => new SolanaAddress(addr);

const network = "Mainnet";
const url = "https://api.mainnet-beta.solana.com";
const oracleProgramId = solAddr("CefQJaxQTV28gCf4MMd1PgDHgCcRmuEHZgXZwjJReUY3");
const oraclePath = `../../price-oracle/solana/${soPath("solana_price_oracle")}`;

const cctprProgramId = solAddr("CctpRNMoG3Xs4MF4i9hAfMQFBZ4zJDvhUA4k2EJd8XEW");
const cctprPath = soPath("cctpr");

const assertSuccess = (txResult: TransactionMetadata | FailedTransactionMetadata) => {
  if (txResult instanceof FailedTransactionMetadata) {
    console.log("tx failed:", txResult.toString());
    assert(false);
  }
  else {
    assert(true);
  }
};

describe("CctpR", function() {
  const forkSvm = createForkSvm(url);
  const solPrice = Conversion.from(usdc(100), Sol);
  const ethPrice = Conversion.from(usdc(2500), EvmGasToken);
  const gasPrice = Conversion.from(evmGasToken(10, "nEvmGasToken"), Gas);

  const feeAdjustments = {
    v1:         { absolute: usdc(1), relative: percentage(100) },
    v2Direct:   { absolute: usdc(2), relative: percentage(100) },
    avaxHop:    { absolute: usdc(3), relative: percentage(100) },
    gasDropoff: { absolute: usdc(0), relative: percentage(105) },
  } as const;

  const createPdaAccount = (
    seeds: Seeds,
    data: Uint8Array,
    programId: SolanaAddress,
  ) => forkSvm.setAccount(
    findPda(seeds, programId)[0].unwrap(),
    {
      owner: programId.unwrap(),
      executable: false,
      lamports: minimumBalanceForRentExemption(byte(data.length)).toUnit("atomic"),
      data,
      rentEpoch: BigInt(0),
      space: BigInt(data.length),
    }
  );

  const createAndSendTx = async (
    instructions: readonly Ix[],
    feePayer: KeyPairSigner,
    signers?: KeyPairSigner[],
  ) => {
    signers = signers ?? [feePayer];
    const blockhash = forkSvm.latestBlockhash() as Blockhash;
    const lastValidBlockHeight = forkSvm.getClock().slot + 10n;
    const compiledTx = pipe(
      createTransactionMessage({ version: "legacy" }),
      tx => setTransactionMessageFeePayer(feePayer.address, tx),
      tx => appendTransactionMessageInstructions(instructions, tx),
      tx => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, tx),
      tx => compileTransaction(tx),
    );
    const signedTx = await signTransaction(signers.map(kp => kp.keyPair), compiledTx);

    return forkSvm.sendTransaction(signedTx);
  };
  
  let [ownerKp, feeAdjusterKp, feeRecipientKp, userKp] = [] as KeyPairSigner[];
  let [owner, feeAdjuster, feeRecipient, user] = [] as SolanaAddress[];

  const setupOracle = async () => {
    forkSvm.addProgramFromFile(oracleProgramId.unwrap(), oraclePath);

    const oracleConfig = { owner, pendingOwner: undefined, solPrice } as const;
    const oracleConfigData = serialize(oracle.configLayout, oracleConfig);
    createPdaAccount(["config"], oracleConfigData, oracleProgramId);

    const ethereumPriceState = {
      oracleChain:    "Ethereum",
      gasTokenPrice:  ethPrice,
      gasPrice:       gasPrice,
      pricePerTxByte: Conversion.from(evmGasToken( 0, "nEvmGasToken"), Byte),
    } as const;
    const ethereumPriceStateData =
      serialize(oracle.priceStateLayout(network).Evm, ethereumPriceState);
    const chainIdSeed = serialize(oracle.chainItem(network), "Ethereum");
    createPdaAccount(["prices", chainIdSeed], ethereumPriceStateData, oracleProgramId); 
  };

  const setupCctpr = async () => {
    forkSvm.addProgramFromFile(cctprProgramId.unwrap(), cctprPath);

    const cctprGovernance = new CctpRGovernance(network, forkSvm, {
      cctpr: cctprProgramId,
      oracle: oracleProgramId,
    });
    const offChainQuoter = new Uint8Array(20);
    const initIx = await cctprGovernance.composeInitializeIx(
      owner,
      owner,
      feeAdjuster,
      feeRecipient,
      offChainQuoter,
    );

    assertSuccess(await createAndSendTx([initIx], ownerKp));

    const registerChainIx = await cctprGovernance.composeRegisterChainIx("Ethereum");
    const updateFeeAdjustmentIxs = await Promise.all(
      feeAdjustmentTypes.map(type => [type, feeAdjustments[type]] as const)
        .map(([corridor, feeAdjustment]) =>
          cctprGovernance.composeUpdateFeeAdjustmentIx("owner", "Ethereum", corridor, feeAdjustment)
        )
    );

    assertSuccess(await createAndSendTx([registerChainIx, ...updateFeeAdjustmentIxs], ownerKp));
  }

  before(async () => {
    [ownerKp, feeAdjusterKp, feeRecipientKp, userKp] =
      await Promise.all(range(4).map(generateKeyPairSigner));
    [owner, feeAdjuster, feeRecipient, user] =
      [ownerKp, feeAdjusterKp, feeRecipientKp, userKp].map(kp => solAddr(kp.address));

    await forkSvm.advanceToNow();

    for (const addr of [owner, feeAdjuster, user])
      forkSvm.airdrop(addr.unwrap(), sol(100).toUnit("atomic"));

    await setupOracle();
    await setupCctpr();
  });

  describe("user", function() {
    const addresses = { cctpr: solAddr(cctprProgramId), oracle: solAddr(oracleProgramId) };
    const cctpr = new CctpR(network, forkSvm, addresses);

    test("quoteRelay", async function() {
      const humanGasDropoff = 0.1;
      const queries = [{
          destinationDomain: "Ethereum",
          corridor: "v1",
          gasDropoff: genericGasToken(0),
        }, {
          destinationDomain: "Ethereum",
          corridor: "v1",
          gasDropoff: genericGasToken(humanGasDropoff),
        }
      ] as const;
      const [quotes, solInUsdc] = await cctpr.quoteOnChainRelay(queries);
      const expectedCosts = [
        gas(165_000).convert(gasPrice).convert(ethPrice).add(feeAdjustments.v1.absolute),
        gas(165_000 + 22_000).convert(gasPrice)
          .add(mulPercentage(evmGasToken(humanGasDropoff), feeAdjustments.gasDropoff.relative))
          .convert(ethPrice).add(feeAdjustments.v1.absolute),
      ];
      assert.deepEqual(quotes[0], expectedCosts[0]);
      assert.deepEqual(quotes[1], expectedCosts[1]);
      assert.deepEqual(solInUsdc, solPrice);
    });

    test("transfer", async function() {

    });
  });

});


// ---- OLD TEST CODE BELOW----
// (only keeping it for now because I might want to compare things when debugging later)

// console.log(liteSvm.getAccount("11111111111111111111111111111111" as Address));

// function createCustomTransport(url: string): RpcTransport {
//   const upstreamTransport = createHttpTransport({ url });

//   return function <TResponse>(
//     transportConfig: any
//   ): Promise<RpcResponse<TResponse>> {
//     console.log(JSON.stringify(transportConfig, null, 2));
//     return upstreamTransport(transportConfig);
//   }
// }

// const rpc = createSolanaRpcFromTransport(createCustomTransport(url));
// console.log(await (rpc.getAccountInfo("2w2zCf9f5iyr7qcuWQH4DFNNahBZHgYkL4UVU3p5T1iS" as Address, { encoding: "base64" }).send()));
// console.log(stringifyJsonWithBigints(await (rpc.getMultipleAccounts([
//   "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC" as Address,
//   "8pzBGC9KkyssMFuckrcZTN52rhMng5ikpqkmQNoKn45V" as Address,
// ], { encoding: "base58" }).send())));

// const transport = createHttpTransport({ url });

// const response = await transport({
//   payload: createRpcMessage({
//     methodName: 'getAccountInfo',
//     params: [
//       // "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
//       // "8pzBGC9KkyssMFuckrcZTN52rhMng5ikpqkmQNoKn45V",
//       "FyrBf5xKg5EwKZ9pHvSpJeLLuCWBicTpm3VvZcsibonk",
//     ],
//   }),
// });
// console.log(response);

// const response = await transport({
//   payload: { id: 1, jsonrpc: '2.0',
//     method: 'getMultipleAccounts',
//     params: [
//       [ 
//         "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
//         // "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
//         // "FyrBf5xKg5EwKZ9pHvSpJeLLuCWBicTpm3VvZcsibond",
//         // "FyrBf5xKg5EwKZ9pHvSpJeLLuCWBicTpm3VvZcsibone",
//       ]
//     ],
//   },
// });
// console.log(stringifyJsonWithBigints(response));
