import { before, describe, test } from "node:test";
import assert from "node:assert";
import type {
  KeyPairSigner,
  Blockhash,
  Instruction,
  TransactionMessage,
  TransactionMessageWithFeePayer,
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
  AccountRole,
} from "@solana/kit";
import { serialize, deserialize } from "binary-layout";

import { Conversion } from "@stable-io/amount";
import { range } from "@stable-io/map-utils";
import {
  UniversalAddress,
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
  Usdc,
  usdc,
  mulPercentage,
  eth,
  usdcContracts
} from "@stable-io/cctp-sdk-definitions";
import type { Seeds, SolanaAddressish } from "@stable-io/cctp-sdk-solana";
import {
  SolanaAddress,
  findPda,
  findAta,
  minimumBalanceForRentExemption,
  tokenAccountLayout,
  tokenProgramId,
} from "@stable-io/cctp-sdk-solana";
import { feeAdjustmentTypes } from "@stable-io/cctp-sdk-cctpr-definitions";
import { CctpRGovernance, CctpR, oracle } from "@stable-io/cctp-sdk-cctpr-solana";
import type {
  FailedTransactionMetadata,
  TransactionMetadata,
  Snapshot,
} from "@stable-io/fork-svm";
import { ForkSvm, createForkRpc } from "@stable-io/fork-svm";

type Ix = Required<Instruction>;
type TxMsg = TransactionMessage & TransactionMessageWithFeePayer;
type SignableTxMsg = Parameters<typeof compileTransaction>[0];

const soPath = (name: string) => `target/sbpf-solana-solana/release/${name}.so`;
const solAddr = (addr: SolanaAddressish) => new SolanaAddress(addr);

const network = "Mainnet";
const usdcMint = solAddr(usdcContracts.contractAddressOf[network]["Solana"]);

const url = "https://api.mainnet-beta.solana.com";
const oracleProgramId = solAddr("CefQJaxQTV28gCf4MMd1PgDHgCcRmuEHZgXZwjJReUY3");
const oraclePath = `../../price-oracle/solana/${soPath("solana_price_oracle")}`;

const cctprProgramId = solAddr("CctpRNMoG3Xs4MF4i9hAfMQFBZ4zJDvhUA4k2EJd8XEW");
const cctprPath = soPath("cctpr");

const cachedAccountsPath = "./tests/accountCache";

const assertSuccess = async (txResult: Promise<TransactionMetadata>) => {
  try {
    await txResult;
  }
  catch(error) {
    console.log("tx should succeed but failed with error:\n" +
      (error as FailedTransactionMetadata)?.toString()
    );
    assert(false);
  }
};

describe("CctpR", function() {
  // const forkSvm = new ForkSvm(url);
  const forkSvm = new ForkSvm();
  const forkRpc = createForkRpc(forkSvm);
  const solPrice = Conversion.from(usdc(100), Sol);
  const ethPrice = Conversion.from(usdc(2500), EvmGasToken);
  const gasPrice = Conversion.from(evmGasToken(10, "nEvmGasToken"), Gas);
  const userUsdcBalance = usdc(100);
  const airdropSol = sol(100);

  const feeAdjustments = {
    v1:         { absolute: usdc(1), relative: percentage(100) },
    v2Direct:   { absolute: usdc(2), relative: percentage(100) },
    avaxHop:    { absolute: usdc(3), relative: percentage(100) },
    gasDropoff: { absolute: usdc(0), relative: percentage(105) },
  } as const;

  let keyPairs = [] as KeyPairSigner[];
  let [cctprOwnerKp, feeAdjusterKp, feeRecipientKp, userKp] = [] as KeyPairSigner[];
  let [cctprOwner, feeAdjuster, feeRecipient, user] = [] as SolanaAddress[];
  let [userUsdc, feeRecipientUsdc] = [] as SolanaAddress[];
  let snapshot: Snapshot;

  const createPdaAccount = (
    seeds: Seeds,
    data: Uint8Array,
    programId: SolanaAddress,
  ) => createAccount(findPda(seeds, programId)[0], data, programId);

  const createAccount = (
    address: SolanaAddress,
    data: Uint8Array,
    programId: SolanaAddress,
  ) => forkSvm.setAccount(address.unwrap(), {
    owner: programId.unwrap(),
    executable: false,
    lamports: minimumBalanceForRentExemption(byte(data.length)).toUnit("atomic"),
    data,
    rentEpoch: BigInt(0),
    space: BigInt(data.length),
  });

  const createUsdcAta = (owner: SolanaAddress, balance: Usdc) => {
    const ata = findAta(owner, usdcMint);
    createAccount(
      ata,
      serialize(
        tokenAccountLayout(Usdc), {
        mint: usdcMint,
        owner,
        amount: balance,
        state: "Initialized",
        isNative: undefined,
        delegate: undefined,
        delegatedAmount: usdc(0),
        closeAuthority: undefined,
      }),
      tokenProgramId,
    );
    return ata;
  }

  const getSolBalance = (address: SolanaAddress) =>
    forkSvm.getAccount(address.unwrap()).then(accInfo => sol(accInfo?.lamports ?? 0, "atomic"));

  const getUsdcBalance = (address: SolanaAddress) =>
    forkSvm.getAccount(address.unwrap())
      .then(accInfo =>
        accInfo
        ? deserialize(tokenAccountLayout(Usdc), accInfo.data).amount
        : usdc(0)
      );

  const createAndSendTx = async (
    instructions: readonly Ix[],
    feePayer: KeyPairSigner,
    signers?: KeyPairSigner[],
  ) => pipe(
    createTransactionMessage({ version: "legacy" }),
    tx => setTransactionMessageFeePayer(feePayer.address, tx),
    tx => appendTransactionMessageInstructions(instructions, tx),
    tx => addLifetimeAndSendTx(tx, signers ?? [feePayer]),
  );

  const addLifetimeAndSendTx = async (tx: TxMsg, signers?: KeyPairSigner[]) => {
    signers = signers ?? keyPairs.filter(kp => kp.address === tx.feePayer.address);
    const blockhash = forkSvm.latestBlockhash() as Blockhash;
    const lastValidBlockHeight = forkSvm.latestBlockheight() + 10n;
    const txWithLifetime =
      setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, tx);
    return sendTx(txWithLifetime, signers);
  }

  const sendTx = async (tx: SignableTxMsg, signers: KeyPairSigner[]) => {
    const compiledTx = compileTransaction(tx);
    const signedTx = await signTransaction(signers.map(kp => kp.keyPair), compiledTx);
    return forkSvm.sendTransaction(signedTx);
  }

  const setupOracle = async () => {
    forkSvm.addProgramFromFile(oracleProgramId.unwrap(), oraclePath);

    const oracleConfig = { owner: cctprOwner, pendingOwner: undefined, solPrice } as const;
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

    const cctprGovernance = new CctpRGovernance(network, forkRpc, {
      cctpr: cctprProgramId,
      oracle: oracleProgramId,
    });
    const offChainQuoter = new Uint8Array(20);
    const initIx = await cctprGovernance.composeInitializeIx(
      cctprOwner,
      cctprOwner,
      feeAdjuster,
      feeRecipient,
      offChainQuoter,
    );

    await assertSuccess(createAndSendTx([initIx], cctprOwnerKp));

    const registerChainIx = await cctprGovernance.composeRegisterChainIx("Ethereum");
    const updateFeeAdjustmentIxs = await Promise.all(
      feeAdjustmentTypes.map(type => [type, feeAdjustments[type]] as const)
        .map(([corridor, feeAdjustment]) =>
          cctprGovernance.composeUpdateFeeAdjustmentIx("owner", "Ethereum", corridor, feeAdjustment)
        )
    );

    await assertSuccess(createAndSendTx([registerChainIx, ...updateFeeAdjustmentIxs], cctprOwnerKp));
  }

  before(async () => {
    await forkSvm.readFromDisc(cachedAccountsPath);

    keyPairs = await Promise.all(range(4).map(generateKeyPairSigner));
    [cctprOwnerKp, feeAdjusterKp, feeRecipientKp, userKp] = keyPairs;
    const roleAddrs = keyPairs.map(kp => solAddr(kp.address));
    [cctprOwner, feeAdjuster, feeRecipient, user] = roleAddrs;
    userUsdc = createUsdcAta(user, userUsdcBalance);
    feeRecipientUsdc = createUsdcAta(feeRecipient, usdc(0));

    await forkSvm.advanceToNow();

    for (const addr of [cctprOwner, feeAdjuster, user])
      forkSvm.airdrop(addr.unwrap(), airdropSol.toUnit("atomic"));

    await setupOracle();
    await setupCctpr();
  });

  describe("user", function() {
    const addresses = { cctpr: solAddr(cctprProgramId), oracle: solAddr(oracleProgramId) };
    const cctpr = new CctpR(network, forkRpc, addresses);

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
      const maxRelayFee = sol(30);
      const tx = await cctpr.transferWithRelay(
        "Ethereum",
        { amount: usdc(100), type: "in" },
        new UniversalAddress("15130512".repeat(5), "Evm"),
        eth(0.1),
        { type: "v1" },
        { type: "onChain", maxRelayFee },
        user,
      );
      await assertSuccess(addLifetimeAndSendTx({ ...tx, version: "legacy" }));
      assert.deepEqual((await getUsdcBalance(userUsdc)), usdc(0));
      assert.deepEqual((await getUsdcBalance(feeRecipientUsdc)), usdc(0));
      assert((await getSolBalance(user)).ge(airdropSol.sub(maxRelayFee)), "maxRelayfee exceeded");
    });

    test("captureTokenMessenger", async function() {
      //just a test for liteSvm to see if it correctly handles bpf upgradeable programs
      const tokenMessengerAddr = solAddr("CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3");
      const configAddr = solAddr("Afgq3BHEfCE7d78D2XE9Bfyu2ieDqvE24xX8KDwreBms");
      const eventAuthorityAddr = solAddr("CNfZLeeL4RUxwfPnjA3tLiQt4y43jp4V7bMpga673jf9");
      const accInfo = (await forkSvm.getAccount(configAddr.unwrap()))!;
      await forkSvm.getAccount(tokenMessengerAddr.unwrap());
      const conf = deserialize(oracle.tokenMessengerConfigLayout, accInfo.data);
      const capturedConf = { ...conf, owner: cctprOwner };
      const data = serialize(oracle.tokenMessengerConfigLayout, capturedConf);
      forkSvm.setAccount(configAddr.unwrap(), { ...accInfo, data });
      await assertSuccess(createAndSendTx([{
        accounts: [
          { address: cctprOwner.unwrap(),         role: AccountRole.READONLY_SIGNER },
          { address: configAddr.unwrap(),         role: AccountRole.WRITABLE        },
          { address: eventAuthorityAddr.unwrap(), role: AccountRole.READONLY        },
          { address: tokenMessengerAddr.unwrap(), role: AccountRole.READONLY        },
        ],
        data: new Uint8Array([65,177,215,73,53,45,99,47, ...range(32)]),
        programAddress: tokenMessengerAddr.unwrap(),
      }], cctprOwnerKp));
      const newConf = deserialize(
        oracle.tokenMessengerConfigLayout,
        (await forkSvm.getAccount(configAddr.unwrap()))!.data
      );
      const expectedConf = { ...capturedConf, pendingOwner: solAddr(new Uint8Array(range(32))) };
      assert.deepEqual(newConf, expectedConf);
    });
  });
});
