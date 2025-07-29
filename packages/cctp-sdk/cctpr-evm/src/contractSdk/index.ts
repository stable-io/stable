// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { Layout } from "binary-layout";
import { serialize, deserialize } from "binary-layout";
import type { RoArray } from "@stable-io/map-utils";
import { range, mapTo, chunk, fromEntries } from "@stable-io/map-utils";
import type { TODO } from "@stable-io/utils";
import { keccak256, encoding } from "@stable-io/utils";
import { Rational } from "@stable-io/amount";
import type {
  DomainsOf,
  GasTokenOf,
  Usdc,
  UniversalAddress,
  EvmGasToken,
  Domain,
  DomainId,
  Network,
} from "@stable-io/cctp-sdk-definitions";
import {
  domains,
  domainOf,
  gasTokenOf,
  usdc,
  genericGasToken,
  evmGasToken,
  usdcContracts,
  v1,
  v2,
  chainIdOf,
  domainIdOf,
  wormholeChainIdOf,
} from "@stable-io/cctp-sdk-definitions";
import type {
  RawAddress,
  EvmClient,
  ContractTx,
  Permit,
  CallData,
  Permit2WitnessTransferFromData,
} from "@stable-io/cctp-sdk-evm";
import {
  wordSize,
  selectorOf,
  selectorLength,
  EvmAddress,
  permit2Address,
  dateToUnixTimestamp,
  paddedSlotItem,
  evmAddressItem,
} from "@stable-io/cctp-sdk-evm";
import type {
  SupportedDomain,
  FeeAdjustmentType,
  InOrOut,
  QuoteBase,
  CorridorParamsBase,
  UsdcQuote,
  UsdcQuoteBase,
  SupportedPlatformDomain,
  ErasedCorridorParams,
} from "@stable-io/cctp-sdk-cctpr-definitions";
import {
  corridors,
  avaxRouterContractAddress,
  feeAdjustmentTypes,
  contractAddressOf,
  quoteIsInUsdc,
  calcBurnAmount,
  calcInputAmount,
  calcFastFee,
  checkIsSensibleCorridor,
  toCorridorVariant,
} from "@stable-io/cctp-sdk-cctpr-definitions";
import type {
  GovernanceCommand,
  QuoteRelay,
  Transfer,
  UserQuoteVariant,
  OffChainQuote,
  ExtraDomain,
  ExtraChainIds,
  FeeAdjustment,
  GaslessQuoteVariant,
} from "./layouts/index.js";
import {
  quoteRelayArrayLayout,
  quoteRelayResultLayout,
  offChainQuoteLayout,
  transferLayout,
  governanceCommandArrayLayout,
  feeAdjustmentsPerSlot,
  chainIdsSlotItem,
  chainIdsPerSlot,
  feeAdjustmentsSlotItem,
  constructorLayout,
  extraDomains,
} from "./layouts/index.js";

//external consumers shouldn't really need these but exporting them just in case
export * as layouts from "./layouts/index.js";

export type SupportedEvmDomain<N extends Network> =
  SupportedPlatformDomain<N, "Evm"> | (
    //eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
    SupportedPlatformDomain<"Mainnet", "Evm"> & SupportedPlatformDomain<"Testnet", "Evm">);

export type Quote<N extends Network, SD extends SupportedEvmDomain<N>> = QuoteBase<N, "Evm", SD>;

export type CorridorParams<
  N extends Network,
  SD extends SupportedEvmDomain<N>,
  DD extends SupportedDomain<N>,
> = CorridorParamsBase<N, "Evm", SD, DD>;

//sign this with the offChainQuoter to produce a valid off-chain quote for a transfer
export const offChainQuoteData = <N extends Network>(network: N) =>
  (params: OffChainQuote<N>) => serialize(offChainQuoteLayout(network), params);

export const execSelector = selectorOf("exec768()");
const get1959Selector = selectorOf("get1959()");

const parseExecCalldata = <const L extends Layout>(calldata: CallData, layout: L) => {
  const selector = calldata.subarray(0, selectorLength);
  if (!encoding.bytes.equals(selector, execSelector))
    throw new Error(`Invalid selector: expected ${execSelector}, got ${selector}`);

  return deserialize(layout, calldata.subarray(selectorLength));
};

export const parseTransferTxCalldata = <N extends Network>(network: N) =>
  (calldata: CallData) => parseExecCalldata(calldata, transferLayout(network));

export const parseGovernanceTxCalldata = <N extends Network>(network: N) =>
  (calldata: CallData) => parseExecCalldata(calldata, governanceCommandArrayLayout(network));

export type GaslessWitness = {
  parameters: {
    baseAmount:        bigint;
    destinationDomain: DomainId;
    mintRecipient:     RawAddress;
    microGasDropoff:   bigint;
    corridor:          "CCTPv1" | "CCTPv2" | "CCTPv2->Avalanche->CCTPv1";
    maxFastFee:        bigint;
    gaslessFee:        bigint;
    maxRelayFee:       bigint;
    quoteSource:       "OffChain" | "OnChain";
  };
};

export type Permit2GaslessData = Permit2WitnessTransferFromData<GaslessWitness>;

export class CctpRBase<N extends Network, SD extends SupportedEvmDomain<N>> {
  public readonly client: EvmClient<N, SD>;
  public readonly address: EvmAddress;

  constructor(client: EvmClient<N, SD>) {
    this.client = client;
    this.address = new EvmAddress((contractAddressOf as TODO)(
      this.client.network, this.client.domain,
    ));
  }

  protected execTx(value: EvmGasToken, commandData: CallData): ContractTx {
    return {
      to: this.address,
      value,
      data: encoding.bytes.concat(execSelector, commandData),
    };
  }
}

export class CctpR<N extends Network, SD extends SupportedEvmDomain<N>> extends CctpRBase<N, SD> {
  //On-chain quotes should always allow for a safety margin of at least a few percent to make sure a
  //  submitted transfer tx does not fail if fees in the oracle get updated while the tx is pending.
  async quoteOnChainRelay(
    queries: RoArray<QuoteRelay<N>>,
  ): Promise<RoArray<Usdc | GasTokenOf<SD>>> {
    if (queries.length === 0)
      return [];

    const encodedBytesResults = await this.client.ethCall({
      to: this.address,
      data: encoding.bytes.concat(
        get1959Selector,
        serialize(quoteRelayArrayLayout(this.client.network), queries) as CallData,
      ),
    });

    if (encodedBytesResults.length === 0)
      throw new Error(
        "Empty result returned by the client. Please check your config params.",
      );

    if (encodedBytesResults.length < 2 * wordSize || encodedBytesResults.length % wordSize !== 0)
      throw new Error("Unexpected result encoding");

    const encodedResults = encodedBytesResults.subarray(2 * wordSize);
    if (encodedResults.length / wordSize !== queries.length)
      throw new Error("Result to query length mismatch");

    return deserialize(quoteRelayResultLayout, encodedResults).map(
      (v, i) => (queries[i]!.quoteRelay === "inUsdc"
        ? usdc
        : gasTokenOf(this.client.domain)
      )(v, "atomic"),
    ) as RoArray<Usdc | GasTokenOf<SD>>;
  }

  checkCostAndCalcRequiredAllowance(
    inOrOut: InOrOut,
    quote: Quote<N, SD>,
    corridor: CorridorParams<N, SD, SupportedDomain<N>>,
    gaslessFee?: Usdc,
  ): Usdc {
    gaslessFee = gaslessFee ?? usdc(0);

    const totalFeesUsdc = gaslessFee.add(quoteIsInUsdc(quote)
      ? (quote.type === "offChain" ? quote.relayFee : quote.maxRelayFee)
      : usdc(0),
    );

    return inOrOut.type === "in"
      ? (() => {
        if (totalFeesUsdc.ge(inOrOut.amount))
          throw new Error(`Costs of ${totalFeesUsdc} exceed input amount of ${inOrOut.amount}`);

        return inOrOut.amount;
      })()
      : totalFeesUsdc.add(calcBurnAmount(inOrOut, corridor, quote, gaslessFee));
  }

  transferWithRelay<DD extends SupportedDomain<N>>(
    destination: DD,
    inOrOut: InOrOut, //meaningless distinction, if relay fee is paid in gas and corridor is v1
    mintRecipient: UniversalAddress,
    gasDropoff: GasTokenOf<DD, SupportedDomain<N>>,
    corridor: CorridorParams<N, SD, DD>,
    quote: Quote<N, SD>,
    permit?: Permit,
  ): ContractTx {
    checkIsSensibleCorridor(this.client.network, this.client.domain, destination, corridor.type);

    const value = evmGasToken(quoteIsInUsdc(quote)
      ? 0n
      : (quote.type === "offChain" ? quote.relayFee : quote.maxRelayFee).toUnit("human"),
    );

    const userQuote = (
      quote.type === "offChain"
      ? { type: "offChain",
          expirationTime: quote.expirationTime,
          quoterSignature: quote.quoterSignature,
          relayFee:
            quote.relayFee.kind.name === "Usdc"
            ? { payIn: "usdc",     amount: quote.relayFee as Usdc                       }
            : { payIn: "gasToken", amount: evmGasToken(quote.relayFee.toUnit("atomic")) },
        }
      : quoteIsInUsdc(quote)
      ? { type: "onChainUsdc",
          takeRelayFeeFromInput: inOrOut.type === "in",
          maxRelayFeeUsdc: quote.maxRelayFee,
        }
      : { type: "onChainGas" }
    ) satisfies UserQuoteVariant;

    const burnAmount = calcBurnAmount(inOrOut, corridor, quote, usdc(0));
    const inputAmountUsdc = calcInputAmount(inOrOut, quote, burnAmount);

    const transfer = {
      ...(permit ? { approvalType: "Permit", permit } : { approvalType: "Preapproval" }),
      inputAmountUsdc,
      destinationDomain: destination as unknown as Transfer<N>["destinationDomain"], //TODO brrr
      mintRecipient,
      gasDropoff: genericGasToken(gasDropoff.toUnit("human")),
      corridorVariant: toCorridorVariant(corridor, burnAmount),
      quoteVariant: userQuote,
    } as const satisfies Transfer<N>;

    return this.execTx(value, serialize(transferLayout(this.client.network), transfer) as CallData);
  }

  composeGaslessTransferMessage<DD extends SupportedDomain<N>>(
    destination: DD,
    cctprAddress: EvmAddress, //FIXME eliminate and use this.address instead
    inOrOut: InOrOut,
    mintRecipient: UniversalAddress,
    gasDropoff: GasTokenOf<DD, SupportedDomain<N>>,
    corridor: CorridorParams<N, SD, DD>,
    quote: UsdcQuoteBase,
    nonce: Uint8Array, //TODO better type
    deadline: Date,
    gaslessFee: Usdc,
  ): Permit2GaslessData {
    checkIsSensibleCorridor(this.client.network, this.client.domain, destination, corridor.type);
    if (nonce.length !== wordSize)
      throw new Error(`Nonce must be ${wordSize} bytes`);

    const erasedCorridor = corridor as ErasedCorridorParams;
    const [network, domain] = [this.client.network, this.client.domain];
    const [amount, baseAmount, burnAmount] =
      this.calcGaslessAmounts(inOrOut, corridor, quote, gaslessFee);

    return {
      types: {
        EIP712Domain: [
          { name: "name",              type: "string"  },
          { name: "chainId",           type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        PermitWitnessTransferFrom: [
          { name: "permitted",  type: "TokenPermissions"         },
          { name: "spender",    type: "address"                  },
          { name: "nonce",      type: "uint256"                  },
          { name: "deadline",   type: "uint256"                  },
          { name: "parameters", type: "TransferWithRelayWitness" },
        ],
        TokenPermissions: [
          { name: "token",  type: "address" },
          { name: "amount", type: "uint256" },
        ],
        TransferWithRelayWitness: [
          { name: "baseAmount",        type: "uint64"  },
          { name: "destinationDomain", type: "uint8"   },
          { name: "mintRecipient",     type: "bytes32" },
          { name: "microGasDropoff",   type: "uint32"  },
          { name: "corridor",          type: "string"  },
          { name: "maxFastFee",        type: "uint64"  },
          { name: "gaslessFee",        type: "uint64"  },
          { name: "maxRelayFee",       type: "uint64"  },
          { name: "quoteSource",       type: "string"  },
        ],
      },
      primaryType: "PermitWitnessTransferFrom",
      domain: {
        name: "Permit2",
        chainId: chainIdOf(network, domain as TODO),
        verifyingContract: permit2Address,
      },
      message: {
        permitted: {
          token: usdcContracts.contractAddressOf[network][domain],
          amount: amount.toUnit("atomic"),
        },
        spender: cctprAddress.unwrap(), //FIXME eliminate and use this.address instead
        nonce: encoding.bignum.decode(nonce),
        deadline: dateToUnixTimestamp(deadline),
        parameters: {
          baseAmount: baseAmount.toUnit("atomic"),
          destinationDomain: domainIdOf(destination),
          mintRecipient: mintRecipient.toString(),
          microGasDropoff: gasDropoff.toUnit("human").mul(1000).floor(),
          corridor: {
            v1:       "CCTPv1" as const,
            v2Direct: "CCTPv2" as const,
            avaxHop:  "CCTPv2->Avalanche->CCTPv1" as const,
          }[corridor.type],
          maxFastFee: erasedCorridor.type === "v1"
            ? 0n
            : calcFastFee(burnAmount, erasedCorridor.fastFeeRate).toUnit("atomic"),
          gaslessFee: gaslessFee.toUnit("atomic"),
          maxRelayFee:
            (quote.type === "offChain" ? quote.relayFee : quote.maxRelayFee).toUnit("atomic"),
          quoteSource: quote.type === "offChain" ? "OffChain" : "OnChain",
        },
      },
    };
  }

  transferGasless<DD extends SupportedDomain<N>>(
    destination: DD,
    inOrOut: InOrOut,
    mintRecipient: UniversalAddress,
    gasDropoff: GasTokenOf<DD, SupportedDomain<N>>,
    corridor: CorridorParams<N, SD, DD>,
    quote: UsdcQuote,
    nonce: Uint8Array, //TODO better type
    deadline: Date,
    gaslessFee: Usdc,
    user: EvmAddress,
    permit2Signature: Uint8Array, //TODO better type
  ): ContractTx {
    const [amount, baseAmount, burnAmount] =
      this.calcGaslessAmounts(inOrOut, corridor, quote, gaslessFee);

    const transfer = {
      approvalType: "Gasless",
      permit2Data: {
        owner: user,
        amount,
        nonce,
        deadline,
        signature: permit2Signature,
      },
      gaslessFeeUsdc: gaslessFee,
      inputAmountUsdc: baseAmount,
      destinationDomain: destination as unknown as Transfer<N>["destinationDomain"], //TODO brrr
      mintRecipient,
      gasDropoff: genericGasToken(gasDropoff.toUnit("human")),
      corridorVariant: toCorridorVariant(corridor, burnAmount),
      quoteVariant: (
        quote.type === "offChain"
        ? { type: "offChain",
            expirationTime: quote.expirationTime,
            relayFee: { payIn: "usdc", amount: quote.relayFee },
            quoterSignature: quote.quoterSignature,
          }
        : { type: "onChainUsdc",
            maxRelayFeeUsdc: quote.maxRelayFee,
            takeRelayFeeFromInput: inOrOut.type === "in",
          }
      ) satisfies GaslessQuoteVariant,
    } as const satisfies Transfer<N>;

    return this.execTx(
      evmGasToken(0),
      serialize(transferLayout(this.client.network), transfer) as CallData,
    );
  }

  private calcGaslessAmounts<DD extends SupportedDomain<N>>(
    inOrOut: InOrOut,
    corridor: CorridorParams<N, SD, DD>,
    quote: UsdcQuoteBase,
    gaslessFee: Usdc,
  ): [amount: Usdc, baseAmount: Usdc, burnAmount: Usdc] {
    const burnAmount = calcBurnAmount(inOrOut, corridor, quote, gaslessFee);
    const [amount, baseAmount] = inOrOut.type === "in"
      ? [ inOrOut.amount,
          inOrOut.amount
            .sub(gaslessFee)
            .sub(quote.type === "offChain" ? quote.relayFee : usdc(0)),
        ]
      : [ burnAmount
            .add(gaslessFee)
            .add(quote.type === "offChain" ? quote.relayFee : quote.maxRelayFee),
          burnAmount,
        ];

    if (baseAmount.le(usdc(0)))
      throw new Error("Base Amount Less or Equal to 0");

    return [amount, baseAmount, burnAmount];
  }
}

export type FeeAdjustments = Record<Domain, FeeAdjustment>;

export class CctpRGovernance<
  N extends Network,
  SD extends SupportedEvmDomain<N>,
> extends CctpRBase<N, SD> {
  static adjustmentSlots = Math.ceil(domains.length / feeAdjustmentsPerSlot);

  //Since the implementation of CctpR has the assumption baked into the contract that new domain
  //  ids will continue to be handed out incrementally (i.e. as last domainId + 1), we make the
  //  same assumption here via:
  static maxMappingIndex = Math.floor((domains.length - 1) / chainIdsPerSlot);

  static feeAdjustmentsAtIndex(
    feeAdjustments: Partial<FeeAdjustments>,
    mappingIndex: number,
  ) {
    const atCost = CctpRGovernance.relayAtCostFeeAdjustment;
    return mapTo(range(feeAdjustmentsPerSlot))((subIndex) => {
      const maybeDomain = domainOf.get(mappingIndex * feeAdjustmentsPerSlot + subIndex);
      return maybeDomain ? feeAdjustments[maybeDomain] ?? atCost : atCost;
    });
  }

  static extraChainsArray<N extends Network>(network: N) {
    return mapTo(chunk(extraDomains(network) as ExtraDomain<N>[], chainIdsPerSlot))(domains =>
      mapTo(range(chainIdsPerSlot))(i =>
        i < domains.length ? wormholeChainIdOf(network, domains[i]! as TODO) : 0,
      ),
    );
  }

  static constructorCalldata<N extends Network>(
    network: N,
    domain: DomainsOf<"Evm">,
    owner: EvmAddress,
    feeAdjuster: EvmAddress,
    feeRecipient: EvmAddress,
    offChainQuoter: EvmAddress,
    priceOracle: EvmAddress,
    feeAdjustments: Record<FeeAdjustmentType, Partial<FeeAdjustments>>,
  ): Uint8Array {
    const definedOrZero = (maybeAddress?: string) =>
      maybeAddress ? new EvmAddress(maybeAddress) : EvmAddress.zeroAddress;

    const arrayFeeAdjustments = mapTo(range(CctpRGovernance.adjustmentSlots))(mappingIndex =>
      mapTo(feeAdjustmentTypes)(feeType => CctpRGovernance.feeAdjustmentsAtIndex(
        feeAdjustments[feeType], mappingIndex,
      )),
    );
    const arrayExtraChains = CctpRGovernance.extraChainsArray(network);
    const tokenMessengerV1 = v1.contractAddressOf(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      network as Network,
      domain as v1.SupportedDomain<Network>,
      "tokenMessenger",
    );
    const tokenMessengerV2 = v2.contractAddressOf(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      network as Network,
      domain as v2.SupportedDomain<Network>,
      "tokenMessenger",
    );
    return serialize(constructorLayout(network), {
      owner,
      feeAdjuster,
      feeRecipient,
      offChainQuoter,
      usdc: new EvmAddress(usdcContracts.contractAddressOf[network][domain]),
      tokenMessengerV1: definedOrZero(tokenMessengerV1),
      tokenMessengerV2: definedOrZero(tokenMessengerV2),
      avaxRouter: definedOrZero(avaxRouterContractAddress[network]),
      priceOracle,
      permit2: new EvmAddress(permit2Address),
      chainData: {
        extraChains: arrayExtraChains,
        feeAdjustments: arrayFeeAdjustments,
      },
    });
  }

  static avaxRouterConstructorCalldata(
    network: Network,
  ): Uint8Array {
    const tokenMessengerV1 = v1.contractAddressOf(network, "Avalanche", "tokenMessenger");
    const messageTransmitterV2 = v2.contractAddressOf(network, "Avalanche", "messageTransmitter");
    const usdc = usdcContracts.contractAddressOf[network]["Avalanche"];
    return serialize([
      { name: "messageTransmitterV2", ...paddedSlotItem(evmAddressItem) },
      { name: "tokenMessengerV1",     ...paddedSlotItem(evmAddressItem) },
      { name: "usdc",                 ...paddedSlotItem(evmAddressItem) },
    ], {
      messageTransmitterV2: new EvmAddress(messageTransmitterV2),
      tokenMessengerV1: new EvmAddress(tokenMessengerV1),
      usdc: new EvmAddress(usdc),
    });
  }

  static gasDropoffConstructorCalldata(
    network: Network,
    domain: DomainsOf<"Evm">,
  ): Uint8Array {
    const messageTransmitterV1 = v1.contractAddressOf(
      network,
      domain as v1.SupportedDomain<Network>,
      "messageTransmitter",
    );
    const messageTransmitterV2 = v2.contractAddressOf(
      network,
      domain as v2.SupportedDomain<Network>,
      "messageTransmitter",
    );
    return serialize([
      { name: "messageTransmitterV1", ...paddedSlotItem(evmAddressItem) },
      { name: "messageTransmitterV2", ...paddedSlotItem(evmAddressItem) },
    ], {
      messageTransmitterV1: new EvmAddress(messageTransmitterV1),
      messageTransmitterV2: new EvmAddress(messageTransmitterV2),
    });
  }

  private static readonly mappings =
    ["extraChainIds", ...corridors, "gasDropoff"] as const;

  static readonly roles =
    ["feeRecipient", "offChainQuoter", "owner", "pendingOwner", "feeAdjuster"] as const;

  //sensible default for fee adjustments on deployment
  static readonly relayAtCostFeeAdjustment =
    { absoluteUsdc: usdc(0), relativePercent: 100 } as const satisfies FeeAdjustment;

  execGovernance(commands: RoArray<GovernanceCommand<N>>): ContractTx {
    return this.execTx(
      evmGasToken(0),
      serialize(governanceCommandArrayLayout(this.client.network), commands) as CallData,
    );
  }

  async getRole(role: typeof CctpRGovernance.roles[number]): Promise<EvmAddress> {
    //initial slots are the mappings
    const rolesSlotOffset = CctpRGovernance.mappings.length;
    const slot = CctpRGovernance.roles.indexOf(role) + rolesSlotOffset;
    return deserialize(paddedSlotItem(evmAddressItem), await this.getStorageAt(slot));
  }

  async getRegisteredChainId(): Promise<ExtraChainIds<N>> {
    //This entire implementation is overkill, seeing how we'll almost certainly never have more
    //  than 12 extra chains but there's not really a reason to start cutting corners here.

    const extraChainIdsSlot = CctpRGovernance.mappings.indexOf("extraChainIds");

    const chainIdChunks = await Promise.all(range(CctpRGovernance.maxMappingIndex - 1).map(i =>
      this.getStorageAt(CctpRGovernance.slotOfKeyInMapping(extraChainIdsSlot, i + 1)).then(raw =>
        deserialize(chainIdsSlotItem, raw),
      ),
    ));

    return fromEntries(
      chainIdChunks
        .flat()
        .slice(domains.length - chainIdsPerSlot)
        .map((chainId, idx) => [domainOf((idx + chainIdsPerSlot) as DomainId), chainId]),
    );
  }

  async getFeeAdjustments(type: FeeAdjustmentType): Promise<FeeAdjustments> {
    const feeTypeMappingSlot = CctpRGovernance.mappings.indexOf(type);

    const feeAdjustmentChunks = await Promise.all(range(CctpRGovernance.maxMappingIndex).map(i =>
      this.getStorageAt(CctpRGovernance.slotOfKeyInMapping(feeTypeMappingSlot, i)).then(raw =>
        deserialize(feeAdjustmentsSlotItem, raw),
      ),
    ));

    return fromEntries(
      feeAdjustmentChunks
        .flat()
        .slice(domains.length)
        .map((feeAdjustment, idx) => [domainOf(idx as DomainId), feeAdjustment]),
    );
  }

  private getStorageAt(slot: number | bigint): Promise<Uint8Array> {
    return this.client.getStorageAt(this.address, BigInt(slot));
  }

  private static slotOfKeyInMapping(
    slotOfMapping: number | bigint,
    key: number | bigint,
  ): bigint {
    return encoding.bignum.decode(keccak256(encoding.bytes.concat(
      encoding.bignum.toBytes(key, wordSize),
      encoding.bignum.toBytes(slotOfMapping, wordSize),
    )));
  }
}
