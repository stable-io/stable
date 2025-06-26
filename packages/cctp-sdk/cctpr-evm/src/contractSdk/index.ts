// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Layout } from "binary-layout";
import { serialize, deserialize } from "binary-layout";
import type { RoArray, Simplify, TupleWithLength } from "@stable-io/map-utils";
import { range } from "@stable-io/map-utils";
import type { TODO } from "@stable-io/utils";
import { keccak256, encoding } from "@stable-io/utils";
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
  EvmClient,
  ContractTx,
  Eip712Data,
  Permit,
  CallData,
  Permit2TypedData,
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
import type { SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";
import { avaxRouterContractAddress } from "@stable-io/cctp-sdk-cctpr-definitions";
import type {
  GovernanceCommand,
  QuoteRelay,
  Transfer,
  CorridorVariant,
  UserQuoteVariant,
  GaslessQuoteVariant,
  OffChainQuote,
  ExtraChainIds,
  FeeAdjustment,
  FeeAdjustmentsSlot,
  FeeAdjustmentType,
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
  feeAdjustmentTypes,
  constructorLayout,
} from "./layouts/index.js";
import { extraDomains } from "./layouts/common.js";

//external consumers shouldn't really need these but exporting them just in case
export * as layouts from "./layouts/index.js";

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

// const tokenPermissionTypeString = "TokenPermissions(address token,uint256 amount)";
// const tokenPermissionTypeHash = keccak256(tokenPermissionTypeString);
// //extra structs are sorted alphabetically according to EIP-712 spec
// const witnessTypeString = [
//   "PermitWitnessTransferFrom(",
//     "TokenPermissions permitted,",
//     "address spender,",
//     "uint256 nonce,",
//     "uint256 deadline,",
//     "TransferWithRelayWitness parameters",
//   ")",
//   //if amount == baseAmount, then all fees are taken from baseAmount
//   //otherwise, amount must equal baseAmount + gaslessFee + maxRelayFee
//   //  (and baseAmount - fastFee will be transferred)
//   tokenPermissionTypeString,
//   "TransferWithRelayWitness(",
//     "uint64 baseAmount,",
//     "uint8 destinationDomain,",
//     "bytes32 mintRecipient,",
//     "uint32 microGasDropoff,",
//     "string corridor,", //"CCTPv1", "CCTPv2", or "CCTPv2->Avalanche->CCTPv1"
//     "uint64 maxFastFee,", //must be 0 for v1 corridor
//     "uint64 gaslessFee,",
//     "uint64 maxRelayFee,", //for off-chain quotes, this is the exact relay fee
//     "string quoteSource,", //"OffChain" or "OnChain"
//     "bytes offChainQuoteSignature,", //empty for onChain quotes
//   ")",
// ].join("");
// const witnessTypeHash = keccak256(witnessTypeString);

type RelayFieldName<T, U> = T extends { type: "offChain" } ? { relayFee: U } : { maxRelayFee: U };
type WithUsdcAndMaybeGasToken<T, S extends DomainsOf<"Evm">, WGT extends boolean> =
  T extends any
  ? (T & RelayFieldName<T, Usdc> & { takeFeesFromInput: boolean } |
    (WGT extends true
    ? T & RelayFieldName<T, GasTokenOf<S, DomainsOf<"Evm">>>
    : never))
  : never;

type OnChainFields = {
  type: "onChain";
};

type OffChainFields = {
  type: "offChain";
  expirationTime: Date;
  quoterSignature: Uint8Array;
};

type GenericQuote<S extends DomainsOf<"Evm">, G extends boolean> =
  Simplify<Readonly<WithUsdcAndMaybeGasToken<OnChainFields | OffChainFields, S, G>>>;

export type Quote<S extends DomainsOf<"Evm">> = GenericQuote<S, true>;
export type GaslessQuote = GenericQuote<DomainsOf<"Evm">, false>;
export type GaslessQuoteMessage = Simplify<
  Exclude<GaslessQuote, { type: "offChain" }> |
  Omit<Extract<GaslessQuote, { type: "offChain" }>, "expirationTime" | "quoterSignature">
>;

export const quoteIsInUsdc = <S extends DomainsOf<"Evm">>(quote: Quote<S>): quote is GaslessQuote =>
  (quote.type === "onChain" && quote.maxRelayFee.kind.name === "Usdc") ||
  (quote.type === "offChain" && quote.relayFee.kind.name === "Usdc");

export class CctpRBase<N extends Network, S extends DomainsOf<"Evm">> {
  public readonly client: EvmClient<N, S>;
  public readonly address: EvmAddress;

  constructor(
    client: EvmClient<N, S>,
    address: EvmAddress,
  ) {
    this.client = client;
    this.address = address;
  }

  protected execTx(value: EvmGasToken, commandData: CallData): ContractTx {
    return {
      to: this.address,
      value,
      data: encoding.bytes.concat(execSelector, commandData),
    };
  }
}
export class CctpR<N extends Network, S extends DomainsOf<"Evm">> extends CctpRBase<N, S> {
  //On-chain quotes should always allow for a safety margin of at least a few percent to make sure a
  //  submitted transfer tx does not fail if fees in the oracle get updated while the tx is pending.
  async quoteOnChainRelay(
    queries: RoArray<QuoteRelay<N>>,
  ): Promise<RoArray<Usdc | GasTokenOf<S>>> {
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
    ) as RoArray<Usdc | GasTokenOf<S>>;
  }

  transferWithRelay<D extends SupportedDomain<N>>(
    destination: D,
    inputAmount: Usdc,
    mintRecipient: UniversalAddress,
    gasDropoff: GasTokenOf<D, SupportedDomain<N>>,
    corridor: CorridorVariant,
    quote: Quote<S>,
    permit?: Permit,
  ): ContractTx {
    CctpR.checkCorridorDestinationCoherence(destination, corridor);

    const value = evmGasToken(
      quote.type === "onChain" && quote.maxRelayFee.kind.name !== "Usdc"
      ? quote.maxRelayFee.toUnit("atomic")
      : quote.type === "offChain" && quote.relayFee.kind.name !== "Usdc"
      ? quote.relayFee.toUnit("atomic")
      : 0n,
      "atomic",
    );

    const userQuote = (
      quote.type === "onChain" && quoteIsInUsdc(quote)
      ? { type: "onChainUsdc",
          takeRelayFeeFromInput: quote.takeFeesFromInput,
          maxRelayFeeUsdc: quote.maxRelayFee,
        }
      : quote.type === "onChain"
      ? { type: "onChainGas" }
      : { type: "offChain",
          expirationTime: quote.expirationTime,
          quoterSignature: quote.quoterSignature,
          feePaymentVariant:
            quote.relayFee.kind.name === "Usdc"
            ? { payIn: "usdc", relayFeeUsdc: quote.relayFee }
            : { payIn: "gasToken", relayFeeGasToken: evmGasToken(quote.relayFee.toUnit("atomic")) },
        }
    ) as UserQuoteVariant;

    const transfer = {
      ...(permit ? { approvalType: "Permit", permit } : { approvalType: "Preapproval" }),
      inputAmountUsdc:
        quote.type === "offChain" && quoteIsInUsdc(quote) && !quote.takeFeesFromInput
        ? inputAmount.add(quote.relayFee)
        : inputAmount,
      destinationDomain: destination as unknown as Transfer<N>["destinationDomain"], //TODO brrr
      mintRecipient,
      gasDropoff: genericGasToken(gasDropoff.toUnit("human")),
      corridorVariant: corridor,
      quoteVariant: userQuote,
    } as const satisfies Transfer<N>;

    return this.execTx(value, serialize(transferLayout(this.client.network), transfer) as CallData);
  }

  static composeGaslessTransferMessage<
    N extends Network,
    S extends SupportedDomain<N>,
    D extends SupportedDomain<N>,
  >(
    network: N,
    source: S,
    destination: D,
    cctprAddress: EvmAddress,
    inputAmount: Usdc,
    mintRecipient: UniversalAddress,
    gasDropoff: GasTokenOf<D, SupportedDomain<N>>,
    corridor: CorridorVariant,
    quote: GaslessQuoteMessage,
    nonce: Uint8Array, //TODO better type
    deadline: Date,
    gaslessFee: Usdc,
  ): Permit2TypedData {
    this.checkCorridorDestinationCoherence(destination, corridor);
    if (nonce.length !== wordSize)
      throw new Error(`Nonce must be ${wordSize} bytes`);

    const maxRelayFee = quote.type === "offChain" ? quote.relayFee : quote.maxRelayFee;
    const amount = quote.takeFeesFromInput
      ? inputAmount
      : inputAmount.add(maxRelayFee).add(gaslessFee);

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
        chainId: chainIdOf(network, source as TODO),
        verifyingContract: permit2Address,
      },
      message: {
        permitted: {
          token: usdcContracts.contractAddressOf[network][source],
          amount: amount.toUnit("atomic"),
        },
        spender: cctprAddress.unwrap(),
        nonce: BigInt(encoding.hex.encode(nonce)),
        deadline: dateToUnixTimestamp(deadline),
        parameters: {
          baseAmount: inputAmount.toUnit("atomic"),
          destinationDomain: domainIdOf(destination),
          mintRecipient: mintRecipient.toString(),
          microGasDropoff: gasDropoff.toUnit("human").mul(1000).floor(),
          corridor:
            corridor.type === "v1"
            ? "CCTPv1"
            : corridor.type === "v2Direct"
            ? "CCTPv2"
            : "CCTPv2->Avalanche->CCTPv1",
          maxFastFee: corridor.type === "v1" ? 0n : corridor.maxFastFeeUsdc.toUnit("atomic"),
          gaslessFee: gaslessFee.toUnit("atomic"),
          maxRelayFee: maxRelayFee.toUnit("atomic"),
          quoteSource: quote.type === "offChain" ? "OffChain" : "OnChain",
        },
      },
    } as const;
  }

  transferGasless<D extends SupportedDomain<N>>(
    destination: D,
    inputAmount: Usdc,
    mintRecipient: UniversalAddress,
    gasDropoff: GasTokenOf<D, SupportedDomain<N>>,
    corridor: CorridorVariant,
    quote: GaslessQuote,
    nonce: Uint8Array, //TODO better type
    deadline: Date,
    gaslessFee: Usdc,
    takeFeesFromInput: boolean,
    permit2Signature: Uint8Array, //TODO better type
  ): ContractTx {
    const transfer = {
      approvalType: "Gasless",
      permit2Data: {
        spender: this.address,
        amount: inputAmount,
        nonce,
        deadline,
        signature: permit2Signature,
      },
      gaslessFeeUsdc: gaslessFee,
      inputAmountUsdc:
        takeFeesFromInput && quote.type === "offChain"
        ? inputAmount.add(quote.relayFee).add(gaslessFee)
        : inputAmount,
      destinationDomain: destination as unknown as Transfer<N>["destinationDomain"], //TODO brrr
      mintRecipient,
      gasDropoff: genericGasToken(gasDropoff.toUnit("human")),
      corridorVariant: corridor,
      quoteVariant: (
        quote.type === "offChain"
        ? { type: "offChain",
            expirationTime: quote.expirationTime,
            feePaymentVariant: { payIn: "usdc", relayFeeUsdc: quote.relayFee },
            quoterSignature: quote.quoterSignature,
          }
        : { type: "onChainUsdc",
            maxRelayFeeUsdc: quote.maxRelayFee,
            takeRelayFeeFromInput: quote.takeFeesFromInput,
          }
      ),
    } as const satisfies Transfer<N>;
    return this.execTx(
      evmGasToken(0),
      serialize(transferLayout(this.client.network), transfer) as CallData,
    );
  }

  static checkCorridorDestinationCoherence(destination: Domain, corridor: CorridorVariant) {
    if (corridor.type === "avaxHop" && destination === "Avalanche")
      throw new Error("Avalanche can't be destination of AvaxHop transfers");
  }
}

export type FeeAdjustments = Record<Domain, FeeAdjustment>;

export class CctpRGovernance<
  N extends Network,
  S extends DomainsOf<"Evm">,
> extends CctpRBase<N, S> {
  static adjustmentSlots = Math.ceil(domains.length / feeAdjustmentsPerSlot);

  static feeAdjustmentsAtIndex(
    feeAdjustments: Partial<FeeAdjustments>,
    mappingIndex: number,
  ) {
    const atCost = CctpRGovernance.relayAtCostFeeAdjustment;
    return range(feeAdjustmentsPerSlot).map((subIndex) => {
      const maybeDomain = domainOf.get(mappingIndex * feeAdjustmentsPerSlot + subIndex);
      return maybeDomain ? feeAdjustments[maybeDomain] ?? atCost : atCost;
    });
  }

  static feeAdjustmentsArray(
    feeAdjustments: Record<FeeAdjustmentType, Partial<FeeAdjustments>>,
  ) {
    return range(CctpRGovernance.adjustmentSlots).map(mappingIndex =>
      feeAdjustmentTypes.map(feeType => CctpRGovernance.feeAdjustmentsAtIndex(
        feeAdjustments[feeType], mappingIndex,
      )) as TupleWithLength<FeeAdjustmentsSlot, 4>,
    );
  }

  static extraChainsArray<N extends Network>(network: N) {
    return range(Math.ceil(extraDomains.length / chainIdsPerSlot))
    .map(slotIndex =>
      range(chainIdsPerSlot).map((subIndex) => {
        const maybeDomain = domainOf.get((slotIndex + 1) * chainIdsPerSlot + subIndex);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return maybeDomain ? wormholeChainIdOf(network, maybeDomain as TODO) ?? 0 : 0;
      }),
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

    const arrayFeeAdjustments = CctpRGovernance.feeAdjustmentsArray(feeAdjustments);
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
    ["extraChainIds", "v1", "v2Direct", "avaxHop", "gasDropoff"] as const;

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

    //Since the implementation of CctpR has the assumption baked into the contract that new domain
    //  ids will continue to be handed out incrementally (i.e. as last domainId + 1), we make the
    //  same assumption here via:
    const maxDomainId = domains.length - 1;
    const maxMappingIndex = Math.floor(maxDomainId / chainIdsPerSlot);

    const chainIdChunks = await Promise.all(range(maxMappingIndex - 1).map(i =>
      this.getStorageAt(CctpRGovernance.slotOfKeyInMapping(extraChainIdsSlot, i + 1)).then(raw =>
        deserialize(chainIdsSlotItem, raw),
      ),
    ));

    return Object.fromEntries(
      chainIdChunks
        .flat()
        .slice(domains.length - chainIdsPerSlot)
        .map((chainId, idx) => [domainOf((idx + chainIdsPerSlot) as DomainId), chainId]),
    ) as ExtraChainIds<N>;
  }

  async getFeeAdjustments(type: FeeAdjustmentType): Promise<FeeAdjustments> {
    const feeTypeMappingSlot = CctpRGovernance.mappings.indexOf(type);
    const maxDomainId = domains.length - 1;
    const maxMappingIndex = Math.floor(maxDomainId / feeAdjustmentsPerSlot);

    const feeAdjustmentChunks = await Promise.all(range(maxMappingIndex).map(i =>
      this.getStorageAt(CctpRGovernance.slotOfKeyInMapping(feeTypeMappingSlot, i)).then(raw =>
        deserialize(feeAdjustmentsSlotItem, raw),
      ),
    ));

    return Object.fromEntries(
      feeAdjustmentChunks
        .flat()
        .slice(domains.length)
        .map((feeAdjustment, idx) => [domainOf(idx as DomainId), feeAdjustment]),
    ) as FeeAdjustments;
  }

  private getStorageAt(slot: number | bigint): Promise<Uint8Array> {
    return this.client.getStorageAt(this.address, BigInt(slot));
  }

  private static slotOfKeyInMapping(
    slotOfMapping: number | bigint,
    key: number | bigint,
  ): bigint {
    return deserialize(
      { binary: "uint", size: wordSize },
      keccak256(serialize([
          { name: "key",  binary: "uint", size: wordSize },
          { name: "slot", binary: "uint", size: wordSize },
        ],
        { key: BigInt(key), slot: BigInt(slotOfMapping) },
      )),
    );
  }
}
