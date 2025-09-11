import { describe, test, before, beforeEach } from "node:test";
import assert from "node:assert";
import util from 'node:util';
import type { Layout } from "binary-layout";
import type {
  KeyPairSigner,
  Blockhash,
  Instruction,
  TransactionMessage,
  TransactionMessageWithFeePayer,
} from "@solana/kit";
import {
  generateKeyPairSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  compileTransaction,
  signTransaction,
  AccountRole,
} from "@solana/kit";
import {
  getCreateAccountInstruction,
  getInitializeNonceAccountInstruction,
} from "@solana-program/system"
import { serialize, deserialize, calcStaticSize } from "binary-layout";
import { range, zip } from "@stable-io/map-utils";
import { secp256k1, keccak256, encoding } from  "@stable-io/utils";
import { Conversion } from "@stable-io/amount";
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
  usdcContracts,
  v1,
  v2,
} from "@stable-io/cctp-sdk-definitions";
import type { Seeds, SolanaAddressish } from "@stable-io/cctp-sdk-solana";
import {
  SolanaAddress,
  findPda,
  findAta,
  feePayerTxFromIxs,
  minimumBalanceForRentExemption,
  tokenAccountLayout,
  tokenProgramId,
  solanaAddressItem,
  instructionLayout,
  durableNonceAccountLayout,
  cctpAccounts,
  v1TokenMessengerConfigLayout,
  v1MessageTransmitterConfigLayout,
  v2MessageTransmitterConfigLayout,
  v1SentEventDataLayout,
  v2SentEventDataLayout,
  anchorEmitCpiDiscriminator as emitDisc,
  remoteTokenMessengerLayout,
  systemProgramId,
} from "@stable-io/cctp-sdk-solana";
import type { Corridor, FeeAdjustmentType } from "@stable-io/cctp-sdk-cctpr-definitions";
import {
  feeAdjustmentTypes,
  offChainQuoteLayout,
  routerHookDataLayout,
  calcUsdcAmounts,
} from "@stable-io/cctp-sdk-cctpr-definitions";
import {
  CctpRGovernance,
  CctpR,
  CctpRReclaim,
  relayRequestEventLayout,
  oracle,
} from "@stable-io/cctp-sdk-cctpr-solana";
import type {
  FailedTransactionMetadata,
  TransactionMetadata,
  Snapshot,
} from "@stable-io/fork-svm";
import { ForkSvm, createForkRpc } from "@stable-io/fork-svm";
import { SolanaKitClient } from "@stable-io/cctp-sdk-solana-kit";

//prevent truncation of objects in error messages
util.inspect.defaultOptions = {
  ...util.inspect.defaultOptions,
  depth: null,
  maxArrayLength: null,
  maxStringLength: null,
  breakLength: Infinity,
  compact: false,
  colors: process.stdout.isTTY,
};

type Ix = Required<Instruction>;
type TxMsg = TransactionMessage & TransactionMessageWithFeePayer;
type SignableTxMsg = Parameters<typeof compileTransaction>[0];

const soPath = (name: string) => `target/sbpf-solana-solana/release/${name}.so`;
const solAddr = (addr: SolanaAddressish) => new SolanaAddress(addr);

const url = "https://api.mainnet-beta.solana.com";
const network = "Mainnet";

const oracleProgramId = solAddr("CefQJaxQTV28gCf4MMd1PgDHgCcRmuEHZgXZwjJReUY3");
const oraclePath = `../../price-oracle/solana/${soPath("solana_price_oracle")}`;

const cctprProgramId = solAddr("CctpRNMoG3Xs4MF4i9hAfMQFBZ4zJDvhUA4k2EJd8XEW");
const cctprPath = soPath("cctpr");

const cachedAccountsPath = "./tests/accountCache";

const usdcMint = solAddr(usdcContracts.contractAddressOf[network]["Solana"]);
const avaxRouterAddress = new UniversalAddress(
  new Uint8Array([...range(11).map(_ => 0), ...range(21)])
);

const assertSuccess = async (txResult: Promise<TransactionMetadata>) => {
  try {
    return await txResult;
  }
  catch(error) {
    console.log("tx should succeed but failed with error:\n" +
      (error as FailedTransactionMetadata)?.toString()
    );
    assert(false);
  }
};

const filterAnchorCpiEvents = (txResult: TransactionMetadata) =>
  txResult.innerInstructions().flatMap((outerIx, outerIndex) =>
    outerIx.filter(innerIx =>
      innerIx.instruction().accounts().length == 1 &&
      encoding.bytes.equals(innerIx.instruction().data().subarray(0, emitDisc.length), emitDisc)
    ).map(innerIx =>
      [innerIx.instruction().data().slice(emitDisc.length), outerIndex] as const
    )
  );

describe("CctpR", function() {
  // const forkSvm = new ForkSvm(url);
  const forkSvm = new ForkSvm();
  const forkRpc = createForkRpc(forkSvm);
  const solPrice = Conversion.from(usdc(100), Sol);
  const ethPrice = Conversion.from(usdc(2500), EvmGasToken);
  const avaPrice = Conversion.from(usdc(24), EvmGasToken);
  const ethGasPrice = Conversion.from(evmGasToken(5, "nEvmGasToken"), Gas);
  const avaGasPrice = Conversion.from(evmGasToken(1, "nEvmGasToken"), Gas);
  const userUsdcStart = usdc(100);
  const airdropSol = sol(100);
  const txExecutionFee = sol(5000, "lamports");
  const sourceDomain = "Solana" as const;
  const destinationDomain = "Ethereum" as const;

  const cctprConstructorArgs =
    [network, new SolanaKitClient(network, forkRpc), { cctpr: cctprProgramId, oracle: oracleProgramId }] as const;

  const feeAdjustments = {
    v1:         { absolute: usdc(1), relative: percentage(101) },
    v2Direct:   { absolute: usdc(2), relative: percentage(102) },
    avaxHop:    { absolute: usdc(3), relative: percentage(103) },
    gasDropoff: { absolute: usdc(0), relative: percentage(105) },
  } as const;

  let solKeyPairs = [] as KeyPairSigner[];
  let [cctprOwnerKp, feeAdjusterKp, _feeRecipientKp, relayerKp, userKp]: KeyPairSigner[] = [];
  let [cctprOwner, feeAdjuster, feeRecipient, relayer, user, nonceAccount]: SolanaAddress[] = [];
  let [userUsdc, feeRecipientUsdc]: SolanaAddress[] = [];
  let snapshot: Snapshot;

  const publicKeyToAddress = (pk: Uint8Array) => keccak256(pk.slice(1)).slice(-20);
  const [[offChainQuoterSk, ...cctpAttesterSks], [offChainQuoter, ...cctpAttesters]] = zip(
    range(3)
      .map(_ => {
        const sk = secp256k1.utils.randomPrivateKey();
        const addr = publicKeyToAddress(secp256k1.getPublicKey(sk, false));
        return [sk, addr] as const;
      })
      .sort((a, b) => {
        //sort keys in ascending order (message transmitter avoids duplicates that way)
        for (let i = 0; i < a[1].length; ++i) {
          const d = a[1][i] - b[1][i];
          if (d !== 0)
            return d;
        }
        return 0;
      })
  );

  const inAnHour = () => new Date(forkSvm.latestTimestamp().getTime() + 3_600_000 );

  const ecdsaSign = (message: Uint8Array, sk: Uint8Array) => {
    const hash = encoding.hex.encode(keccak256(message));
    const sig = secp256k1.sign(hash, sk, { lowS: true });
    return encoding.bytes.concat(sig.toCompactRawBytes(), new Uint8Array([sig.recovery + 27]));
  }

  const spoofCctpAttestation = (message: Uint8Array) =>
    encoding.bytes.concat(...cctpAttesterSks.map(sk => ecdsaSign(message, sk)));

  const ecrecoverAddress = (message: Uint8Array, signature: Uint8Array) =>
    publicKeyToAddress(
      secp256k1.Signature
        .fromCompact(encoding.hex.encode(signature.subarray(0, 64), false))
        .addRecoveryBit(signature[64] - 27)
        .recoverPublicKey(encoding.hex.encode(keccak256(message)))
        .toBytes(false)
    );

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

  const createPdaAccount = (
    seeds: Seeds,
    data: Uint8Array,
    programId: SolanaAddress,
  ) => createAccount(findPda(seeds, programId)[0], data, programId);

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

  const getDeserializedAccount = <L extends Layout>(address: SolanaAddress, layout: L) =>
    forkSvm.getAccount(address.unwrap()).then(accInfo => deserialize(layout, accInfo!.data));

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
    signers?: readonly KeyPairSigner[],
  ) => addLifetimeAndSendTx(
    feePayerTxFromIxs(instructions, new SolanaAddress(feePayer.address)),
    signers ?? [feePayer],
  );

  const addLifetimeAndSendTx = async (tx: TxMsg, signers?: readonly KeyPairSigner[]) => {
    signers = signers ?? solKeyPairs.filter(kp => kp.address === tx.feePayer.address);
    const blockhash = forkSvm.latestBlockhash() as Blockhash;
    const lastValidBlockHeight = forkSvm.latestBlockheight() + 10n;
    const txWithLifetime =
      setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, tx);
    return sendTx(txWithLifetime, signers);
  }

  const sendTx = async (tx: SignableTxMsg, signers: readonly KeyPairSigner[]) => {
    const compiledTx = compileTransaction(tx);
    const signedTx = await signTransaction(signers.map(kp => kp.keyPair), compiledTx);
    return forkSvm.sendTransaction(signedTx);
  }

  const overrideMessageTransmittersAttester = async () => {
    for (const version of ["v1", "v2"]) {
      const { messageTransmitterConfig } = cctpAccounts[network][version];
      const accInfo = (await forkSvm.getAccount(messageTransmitterConfig.unwrap()))!;
      const layout = version === "v1"
        ? v1MessageTransmitterConfigLayout
        : v2MessageTransmitterConfigLayout;
      const conf = deserialize(layout, accInfo.data);
      const newConf = {
        ...conf,
        signatureThreshold: cctpAttesters.length,
        enabledAttesters: [
          ...cctpAttesters.map(evmAddr =>
            solAddr(encoding.bytes.zpad(evmAddr, SolanaAddress.byteSize))
          ),
          ...conf.enabledAttesters.slice(cctpAttesters.length)
        ],
      };
      forkSvm.setAccount(messageTransmitterConfig.unwrap(), {
        ...accInfo,
        data: serialize(layout, newConf),
      });
    }
  }

  const setupOracle = async () => {
    forkSvm.addProgramFromFile(oracleProgramId.unwrap(), oraclePath);

    const oracleConfig = { owner: cctprOwner, pendingOwner: undefined, solPrice } as const;
    const oracleConfigData = serialize(oracle.configLayout, oracleConfig);
    createPdaAccount(["config"], oracleConfigData, oracleProgramId);

    const priceStates = [{
      oracleChain:    destinationDomain,
      gasTokenPrice:  ethPrice,
      gasPrice:       ethGasPrice,
      pricePerTxByte: Conversion.from(evmGasToken( 0, "nEvmGasToken"), Byte),
    }, {
      oracleChain:    "Avalanche",
      gasTokenPrice:  avaPrice,
      gasPrice:       avaGasPrice,
      pricePerTxByte: Conversion.from(evmGasToken( 0, "nEvmGasToken"), Byte),
    }] as const;
    for (const priceState of priceStates) {
      const priceStateData = serialize(oracle.priceStateLayout(network).Evm, priceState);
      const chainIdSeed = serialize(oracle.chainItem(network), priceState.oracleChain);
      createPdaAccount(["prices", chainIdSeed], priceStateData, oracleProgramId);
    }
  };

  const setupCctpr = async () => {
    forkSvm.addProgramFromFile(cctprProgramId.unwrap(), cctprPath);

    const cctprGovernance = new CctpRGovernance(network, new SolanaKitClient(network, forkRpc), {
      cctpr: cctprProgramId,
      oracle: oracleProgramId,
    });
    const initIx = await cctprGovernance.composeInitializeIx(
      cctprOwner,
      cctprOwner,
      feeAdjuster,
      feeRecipient,
      offChainQuoter,
    );

    await assertSuccess(createAndSendTx([initIx], cctprOwnerKp));

    const registerDestination = await cctprGovernance.composeRegisterChainIx(destinationDomain);
    const registerAvaxHop     = await cctprGovernance.composeRegisterChainIx("Avalanche");
    const updateFeeAdjustmentIxs = await Promise.all(
      feeAdjustmentTypes.map(type => [type, feeAdjustments[type]] as const)
        .flatMap(([corridor, feeAdjustment]) =>
          ([destinationDomain, "Avalanche"] as const).map(domain =>
            cctprGovernance.composeUpdateFeeAdjustmentIx("owner", domain, corridor, feeAdjustment)
          )
        )
    );

    await assertSuccess(
      createAndSendTx([
        registerDestination,
        registerAvaxHop,
        ...updateFeeAdjustmentIxs
      ], cctprOwnerKp)
    );
  }

  before(async () => {
    await forkSvm.readFromDisc(cachedAccountsPath);

    solKeyPairs = await Promise.all(range(5).map(generateKeyPairSigner));
    [cctprOwnerKp, feeAdjusterKp, _feeRecipientKp, relayerKp, userKp] = solKeyPairs;
    [cctprOwner, feeAdjuster, feeRecipient, relayer, user] =
      solKeyPairs.map(kp => solAddr(kp.address));
    userUsdc = createUsdcAta(user, userUsdcStart);
    feeRecipientUsdc = createUsdcAta(feeRecipient, usdc(0));

    await forkSvm.advanceToNow();

    for (const addr of [cctprOwner, feeAdjuster, relayer, user])
      forkSvm.airdrop(addr.unwrap(), airdropSol.toUnit("atomic"));

    await overrideMessageTransmittersAttester();
    await setupOracle();
    await setupCctpr();

    const nonceAccountKp = await generateKeyPairSigner();
    nonceAccount = solAddr(nonceAccountKp.address);
    const nonceAccountSize = calcStaticSize(durableNonceAccountLayout)!;
    await assertSuccess(createAndSendTx(
      [ getCreateAccountInstruction({
          payer: relayerKp,
          newAccount: nonceAccountKp,
          lamports: minimumBalanceForRentExemption(byte(nonceAccountSize)).toUnit("atomic"),
          space: BigInt(nonceAccountSize),
          programAddress: systemProgramId.unwrap(),
        }),
        getInitializeNonceAccountInstruction({
          nonceAuthority: relayer.unwrap(),
          nonceAccount: nonceAccount.unwrap(),
        })
      ],
      relayerKp,
      [relayerKp, nonceAccountKp]
    ));
    forkSvm.expireBlockhash();
    forkSvm.setClock(
      new Date(forkSvm.latestTimestamp().getTime() + 1000),
      forkSvm.latestBlockheight() + 1n
    );
    snapshot = forkSvm.getSnapshot();
  });

  describe("test setup", () => {
    test("ecrecover", async () => {
      const message = new Uint8Array(32).fill(1);
      const attestation = spoofCctpAttestation(message);
      const recovered = ecrecoverAddress(message, attestation.slice(0, 65));
      assert.deepStrictEqual(recovered, cctpAttesters[0]);
    });

    test("testing setup by executing tx against a bpf upgradeable program", async () => {
      const { tokenMessenger, tokenMessengerConfig, eventAuthority } = cctpAccounts.Mainnet.v1;

      //make ourselves the owner by just overwriting the config
      const accInfo = (await forkSvm.getAccount(tokenMessengerConfig.unwrap()))!;
      await forkSvm.getAccount(tokenMessenger.unwrap());
      const conf = deserialize(v1TokenMessengerConfigLayout, accInfo.data);
      const capturedConf = { ...conf, owner: cctprOwner };
      forkSvm.setAccount(
        tokenMessengerConfig.unwrap(),
        { ...accInfo, data: serialize(v1TokenMessengerConfigLayout, capturedConf) },
      );

      //now compose and send an ownership transfer tx
      const newPending = solAddr(new Uint8Array(range(32)));
      const transferOwnershipIxLayout =
        instructionLayout("transfer_ownership", [{ name: "newPending", ...solanaAddressItem }]);
      const transferOwnershipIx = {
        accounts: [
          { address: cctprOwner          .unwrap(), role: AccountRole.READONLY_SIGNER },
          { address: tokenMessengerConfig.unwrap(), role: AccountRole.WRITABLE        },
          { address: eventAuthority      .unwrap(), role: AccountRole.READONLY        },
          { address: tokenMessenger      .unwrap(), role: AccountRole.READONLY        },
        ],
        data: serialize(transferOwnershipIxLayout, { newPending }),
        programAddress: tokenMessenger.unwrap(),
      } as const;
      await assertSuccess(createAndSendTx([transferOwnershipIx], cctprOwnerKp));

      //finally, check that our designated address is indeed the new pending owner
      const newConf = await getDeserializedAccount(
        tokenMessengerConfig,
        v1TokenMessengerConfigLayout,
      );
      const expectedConf = { ...capturedConf, pendingOwner: newPending };
      assert.deepStrictEqual(newConf, expectedConf);
    });
  });

  describe("flow: quote -> transfer -> reclaim", () => {
    const cctpr = new CctpR(...cctprConstructorArgs);
    const rentCustodian = findPda(["rent"], cctpr.address)[0];
    const userEvmAddress = new UniversalAddress("15130512".repeat(5), "Evm");

    const humanGasDropoff = 0.01; //25 dollars worth of gas on Ethereum
    const humanGaslessFee = 1; //1 usdc

    const gasCosts = {
      avaxHop:    281_200,
      gasDropoff:  22_000,
      v1:         165_000,
      v2:         175_000,
    } as const;
    const fastFeeRate = percentage(5, "bp");
    const transferAmount = {
      in: userUsdcStart,
      out: userUsdcStart.div(2),
    } as const;

    const modes = ["gas", "usdc", "gasless"] as const;
    type Mode = typeof modes[number];
    const inOrOuts = ["in", "out"] as const;
    type InOrOut = "in" | "out";
    type TestCase = [Mode, InOrOut, Corridor, boolean, boolean];
    //to also test "avaxHop", temporarily comment out the last check in checkIsSensibleCorridor
    //  that prevents using the avax hop when the destination is a viable v2 domain
    const testCorridors = ["v1", "v2Direct" /*, "avaxHop"*/] as const;
    const testCases: TestCase[] = [];
    for (const mode of modes)
      for (const inOrOut of inOrOuts)
        for (const corridor of testCorridors)
          for (const withGasDropoff of [true, false])
            for (const useOnChainQuote of [true, false])
              testCases.push(
                [mode, inOrOut, corridor, withGasDropoff, useOnChainQuote] as const
              );


    const eventDataLayout = {
      v1:       v1SentEventDataLayout,
      v2Direct: v2SentEventDataLayout(),
      avaxHop:  v2SentEventDataLayout(routerHookDataLayout(network)),
    } as const;
    const stringifyTestCase = (testCase: TestCase) =>
      `${testCase[0] === "gasless" ? "gasless" : "user-initiated-" + testCase[0]}, ` +
      `${testCase[1]}, ` +
      `${testCase[2]}, ` +
      `${testCase[3] ? "with" : "without"} gas dropoff, ` +
      `${testCase[4] ? "onchain" : "offchain"} quote`;

    const applyFeeAdjustment = (usdcAmount: Usdc, faType: FeeAdjustmentType) => {
      const { relative, absolute } = feeAdjustments[faType];
      return mulPercentage(usdcAmount, relative).floorTo("atomic").add(absolute);
    }

    const relayFeeOf = (corridor: Corridor, withGasDropoff: boolean) => {
      const executionFee =
        gas(
          gasCosts[corridor === "v2Direct" ? "v2" : "v1"] +
          (withGasDropoff ? gasCosts.gasDropoff : 0)
        )
        .convert(ethGasPrice).floorTo("atomic")
        .convert(ethPrice).floorTo("atomic");

      const avaxHopFee = corridor === "avaxHop"
        ? gas(gasCosts.avaxHop)
          .convert(avaGasPrice).floorTo("atomic")
          .convert(avaPrice).floorTo("atomic")
        : usdc(0);

      const gasDropoffFee = withGasDropoff
        ? applyFeeAdjustment(
            evmGasToken(humanGasDropoff).convert(ethPrice).floorTo("atomic"),
            "gasDropoff"
          )
        : usdc(0);

      const adjustedFee = applyFeeAdjustment(executionFee.add(avaxHopFee), corridor);

      return adjustedFee.add(gasDropoffFee);
    }

    for (const [index, testCase] of testCases.entries())
      test(index.toString() + ": " + stringifyTestCase(testCase), async (t) => {
        const [mode, inOrOut, corridor, withGasDropoff, useOnChainQuote] = testCase;
        forkSvm.restoreFromSnapshot(snapshot);
        const eventDataSeed = serialize({ binary: "uint", size: 4 }, index);
        const eventDataAddr = findPda([user, eventDataSeed], cctpr.address)[0];
        const gaslessFee = mode === "gasless" ? usdc(humanGaslessFee) : usdc(0);

        const gasDropoff = genericGasToken(withGasDropoff ? humanGasDropoff : 0);
        const relayFeeUsdc = relayFeeOf(corridor, withGasDropoff);
        const relayFeeSol = relayFeeUsdc.convert(solPrice.inv());
        const rentRebate = cctpr.cctpMessageRentCost(corridor);
        const exactRelayFee = mode === "gas"
          ? relayFeeSol.sub(rentRebate)
          : relayFeeUsdc.sub(mode === "gasless" ? usdc(0) : rentRebate.convert(solPrice));
        const maxRelayFee = exactRelayFee;

        await t.test("quoteRelay", async () => {
          const queries = [{ destinationDomain, corridor, gasDropoff }];
          const [quote, fetchedSolPrice] = await cctpr.quoteOnChainRelay(queries);

          assert.equal(quote.length, 1);
          assert.deepStrictEqual(quote[0], relayFeeUsdc);
          assert.deepStrictEqual(fetchedSolPrice, solPrice);
        });

        await t.test("transfer", async () => {
          const corridorParams = corridor === "v1"
              ? { type: "v1" }
              : { type: corridor, fastFeeRate };
          const sendableTx = (async () => {
            const relayFee = maxRelayFee as any;
            const quoteVariant = useOnChainQuote
              ? { type: "onChain", maxRelayFee: relayFee } as const
              : (() => {
                const expirationTime = inAnHour();
                const serializedOffchainQuote =
                  serialize(offChainQuoteLayout(network, "Solana", Sol), {
                    sourceDomain,
                    destinationDomain,
                    corridor,
                    gasDropoff,
                    expirationTime,
                    relayFeeVariant: {
                      payIn: mode === "gas" ? "gasToken" : "usdc",
                      amount: relayFee,
                    },
                  });
                const quoterSignature = ecdsaSign(serializedOffchainQuote, offChainQuoterSk);
                return { type: "offChain", expirationTime, quoterSignature, relayFee } as const;
              })();

            const sharedTransferArgs = [
              destinationDomain,
              { amount: transferAmount[inOrOut], type: inOrOut },
              userEvmAddress,
              eth(gasDropoff.toUnit("human")),
              corridorParams as any,
              quoteVariant,
              user,
            ] as const;
            const opts = { eventDataSeed } as const;

            return mode === "gasless"
              ? sendTx({
                  ...(await cctpr.transferGasless(
                    ...sharedTransferArgs,
                    inAnHour(),
                    gaslessFee,
                    relayer,
                    nonceAccount,
                    opts
                  )),
                  version: "legacy",
                }, [userKp, relayerKp])
              : addLifetimeAndSendTx({
                  ...(await cctpr.transferWithRelay(...sharedTransferArgs, opts)),
                  version: "legacy",
                }, [userKp]
              );
          })();

          const txResult = await assertSuccess(sendableTx);
          // console.log("logs:", txResult.logs().join("\n"));

          //check cpi event
          const cpiEvents = filterAnchorCpiEvents(txResult);
          assert.equal(cpiEvents.length, 2); //cctpMessageTransmitter and cctpr
          const [eventData, instructionIndex] = cpiEvents[1];
          assert.equal(instructionIndex, mode === "gasless" ? 1 : 0); //paranoid but whatever
          const relayRequestEvent = deserialize(relayRequestEventLayout, eventData);
          if (corridor !== "v1")
            assert.equal(relayRequestEvent.v1Nonce, 0n);

          assert.deepStrictEqual(relayRequestEvent.gasDropoff, gasDropoff);
          assert.deepStrictEqual(
            await getSolBalance(user),
            airdropSol
              .sub(mode === "gas" ? exactRelayFee as Sol : sol(0))
              .sub(mode === "gasless" ? sol(0) : txExecutionFee.add(rentRebate))
          );

          const userUsdcAfter = await getUsdcBalance(userUsdc);
          const [userUsdcSpent, , burnAmount] = calcUsdcAmounts(
            { amount: transferAmount[inOrOut], type: inOrOut },
            corridorParams as any,
            useOnChainQuote
            ? { type: "onChain",  maxRelayFee }
            : { type: "offChain", relayFee: maxRelayFee },
            gaslessFee
          );
          assert.deepStrictEqual(userUsdcAfter, userUsdcStart.sub(userUsdcSpent));

          assert.deepStrictEqual(
            await getSolBalance(feeRecipient),
            mode === "gas" ? maxRelayFee : sol(0),
          );

          assert.deepStrictEqual(
            await getUsdcBalance(feeRecipientUsdc),
            mode === "gas" ? usdc(0) : (exactRelayFee as Usdc).add(gaslessFee)
          );

          const { tokenMessenger, remoteTokenMessengers } =
            cctpAccounts[network][corridor === "v1" ? "v1" : "v2"];
          const remoteTokenMessenger = (await getDeserializedAccount(
            remoteTokenMessengers[corridor === "avaxHop" ? "Avalanche" : destinationDomain],
            remoteTokenMessengerLayout
          )).tokenMessenger;

          const sentEventData =
            await getDeserializedAccount(eventDataAddr, eventDataLayout[corridor]);
          const destinationCaller = corridor === "avaxHop"
            ? avaxRouterAddress
            : UniversalAddress.zeroAddress;

          //burn amount is calculated with the assumption that the relay fee for on-chain quotes
          //  can be arbitrarily small (since there's no lower bound for how much the price
          //  oracle can revise prices down while the tx is in flight), so we have to add it
          //  back in here (because in our test case, we know exactly how much will be charged)
          const sentAmount = inOrOut === "in" && mode !== "gas" && useOnChainQuote
            ? burnAmount.sub(maxRelayFee as Usdc)
            : burnAmount;

          assert.deepStrictEqual(sentEventData, {
            rentPayer:           rentCustodian,
            ...( corridor === "v1"
              ? {}
              : { createdAt: forkSvm.latestTimestamp() }
            ),
            message: {
              sourceDomain,
              destinationDomain: corridor === "avaxHop" ? "Avalanche" : destinationDomain,
              nonce:             corridor === "v1" ? relayRequestEvent.v1Nonce : new Uint8Array(32),
              sender:            tokenMessenger.toUniversalAddress(),
              recipient:         remoteTokenMessenger,
              destinationCaller,
              ...( corridor === "v1"
                ? {}
                : { minFinalityThreshold: 0, finalityThresholdExecuted: 0 }
              ),
              messageBody: {
                burnToken:       usdcMint.toUniversalAddress(),
                mintRecipient:   userEvmAddress,
                amount:          sentAmount,
                messageSender:   user.toUniversalAddress(),
                ...( corridor === "v1"
                  ? {}
                  : { hookData: corridor === "avaxHop"
                        ? { destinationDomain,
                            mintRecipient: userEvmAddress,
                            gasDropoff,
                          }
                        : new Uint8Array(0),
                      maxFee:          (sentEventData as any).message.messageBody.maxFee,
                      feeExecuted:     (sentEventData as any).message.messageBody.feeExecuted,
                      expirationBlock: (sentEventData as any).message.messageBody.expirationBlock,
                    }
                ),
              }
            }
          });
        });

        await t.test("reclaim", async () => {
          const reclaimCctpr = new CctpRReclaim(...cctprConstructorArgs);
          const sentEventData =
            await getDeserializedAccount(eventDataAddr, eventDataLayout[corridor]);

          if (corridor !== "v1") {
            const cctpMessageRetentionWindow = 60 * 60 * 24 * 5 * 1000;
            forkSvm.setClock(
              new Date(forkSvm.latestTimestamp().getTime() + cctpMessageRetentionWindow * 10),
              forkSvm.latestBlockheight() + 1000n
            );
          }
          const serMsg = serialize({
              v1:       v1.burnMessageLayout(),
              v2Direct: v2.burnMessageLayout(),
              avaxHop:  v2.burnMessageLayout(routerHookDataLayout(network)),
            }[corridor],
            sentEventData.message
          );
          const attestation = spoofCctpAttestation(serMsg);
          const reclaimIx = await reclaimCctpr.composeReclaimRentIx(
            eventDataAddr,
            attestation,
            corridor !== "v1" ? serMsg : undefined
          );
          const instructions = [reclaimIx, await reclaimCctpr.composeTransferSurplusSolIx()];
          const rent = await getSolBalance(eventDataAddr);
          const balanceBefore = await getSolBalance(feeRecipient);
          await assertSuccess(createAndSendTx(instructions, relayerKp));
          assert.deepStrictEqual(await getSolBalance(eventDataAddr), sol(0))
          assert.deepStrictEqual(await getSolBalance(feeRecipient), balanceBefore.add(rent));
        });
      });
  });

  describe("Governance", () => {
    let governance: CctpRGovernance<typeof network>;

    beforeEach(() => {
      forkSvm.restoreFromSnapshot(snapshot);
      //reinitialize so we don't run into issues with the config being stale
      governance = new CctpRGovernance(...cctprConstructorArgs);
    });

    test("owner transfer request lifecycle", async (t) => {
      const newOwnerKp = await generateKeyPairSigner();
      const newOwner = solAddr(newOwnerKp.address);

      await t.test("submit owner transfer request", async () => {
        const submitIx = await governance.composeSubmitOwnerTransferRequestIx(newOwner);
        await assertSuccess(createAndSendTx([submitIx], cctprOwnerKp));

        const config = await governance.config();
        assert.deepStrictEqual(config.pendingOwner, newOwner);
      });

      await t.test("cancel owner transfer request", async () => {
        const cancelIx = await governance.composeCancelOwnerTransferRequestIx();
        await assertSuccess(createAndSendTx([cancelIx], cctprOwnerKp));

        const config = await governance.config();
        assert.deepStrictEqual(config.pendingOwner, solAddr(SolanaAddress.zeroAddress));
      });

      await t.test("submit and confirm owner transfer request", async () => {
        forkSvm.airdrop(newOwner.unwrap(), airdropSol.toUnit("atomic"));

        const submitIx = await governance.composeSubmitOwnerTransferRequestIx(newOwner);
        await assertSuccess(createAndSendTx([submitIx], cctprOwnerKp));

        const confirmIx = await governance.composeConfirmOwnerTransferRequestIx();
        await assertSuccess(createAndSendTx([confirmIx], newOwnerKp));

        const config = await governance.config();
        assert.deepStrictEqual(config.owner, newOwner);
        assert.deepStrictEqual(config.pendingOwner, solAddr(SolanaAddress.zeroAddress));
      });
    });

    test("chain deregistration", async () => {
      const deregisterIx = await governance.composeDeregisterChainIx("Avalanche");
      await assertSuccess(createAndSendTx([deregisterIx], cctprOwnerKp));

      const feeAdjustment = { absolute: usdc(1), relative: percentage(101) };
      const updateIx = await governance.composeUpdateFeeAdjustmentIx(
        "owner", "Avalanche", "v1", feeAdjustment
      );
      await assert.rejects(createAndSendTx([updateIx], cctprOwnerKp));
    });

    test("role updates", async (t) => {
      await t.test("update fee recipient", async () => {
        const newFeeRecipientKp = await generateKeyPairSigner();
        const newFeeRecipient = solAddr(newFeeRecipientKp.address);

        const updateIx = await governance.composeUpdateFeeRecipientIx(newFeeRecipient);
        await assertSuccess(createAndSendTx([updateIx], cctprOwnerKp));

        const config = await governance.config();
        assert.deepStrictEqual(config.feeRecipient, newFeeRecipient);
      });

      await t.test("update fee adjuster", async () => {
        const newFeeAdjusterKp = await generateKeyPairSigner();
        const newFeeAdjuster = solAddr(newFeeAdjusterKp.address);

        const updateIx = await governance.composeUpdateFeeAdjusterIx(newFeeAdjuster);
        await assertSuccess(createAndSendTx([updateIx], cctprOwnerKp));

        const config = await governance.config();
        assert.deepStrictEqual(config.feeAdjuster, newFeeAdjuster);
      });

      await t.test("update offchain quoter", async () => {
        const newOffchainQuoter = new Uint8Array([...range(20).map(i => i + 100)]);

        const updateIx = await governance.composeUpdateOffchainQuoterIx(newOffchainQuoter);
        await assertSuccess(createAndSendTx([updateIx], cctprOwnerKp));

        const config = await governance.config();
        assert.deepStrictEqual(config.offchainQuoter, newOffchainQuoter);
      });

      await t.test("reject invalid fee recipient", async () => {
        await assert.rejects(governance.composeUpdateFeeRecipientIx(SolanaAddress.zeroAddress));
      });
    });

    test("fee adjustments by fee adjuster role", async () => {
      const newFeeAdjustment = { absolute: usdc(5), relative: percentage(110) };
      const updateIx = await governance.composeUpdateFeeAdjustmentIx(
        "feeAdjuster", destinationDomain, "v1", newFeeAdjustment
      );

      await assertSuccess(createAndSendTx([updateIx], feeAdjusterKp));
    });
  });
});
