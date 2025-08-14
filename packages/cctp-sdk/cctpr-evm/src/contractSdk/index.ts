// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { Layout } from "binary-layout";
import { serialize, deserialize } from "binary-layout";
import type { RoArray, Simplify, TupleWithLength } from "@stable-io/map-utils";
import { range } from "@stable-io/map-utils";
import type { TODO } from "@stable-io/utils";
import { keccak256, encoding, assertDistinct } from "@stable-io/utils";
import type {
  DomainsOf,
  GasTokenOf,
  Usdc,
  UniversalAddress,
  EvmGasToken,
  Domain,
  DomainId,
  Network,
  Percentage,
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
import {
  avaxRouterContractAddress,
  contractAddressOf,
} from "@stable-io/cctp-sdk-cctpr-definitions";
import type {
  Corridor,
  GovernanceCommand,
  QuoteRelay,
  Transfer,
  UserQuoteVariant,
  OffChainQuote,
  ExtraChainIds,
  FeeAdjustment,
  FeeAdjustmentsSlot,
  FeeAdjustmentType,
  CorridorVariant,
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
  corridors,
} from "./layouts/index.js";
import { extraDomains } from "./layouts/common.js";
import { Rational } from "@stable-io/amount";

//external consumers shouldn't really need these but exporting them just in case
export * as layouts from "./layouts/index.js";
export { extraDomains } from "./layouts/common.js";

export type SupportedEvmDomain<N extends Network> = SupportedDomain<N> & DomainsOf<"Evm">;

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
//     "TokenPermissions permitted,",corridor
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

type QtOnChain = { readonly type: "onChain" };
type QtOffChain = { readonly type: "offChain" };

type ExtraFields<QT> =
  QT extends QtOnChain
  ? unknown
  : Readonly<{
    expirationTime: Date;
    quoterSignature: Uint8Array;
  }>;

type RelayFieldName<T, U> = Readonly<T extends QtOnChain ? { maxRelayFee: U } : { relayFee: U }>;
type QuoteTypeImpl<
  WEF extends boolean, //with extra fields
  GT = never,
> = Simplify<
  QtOnChain | QtOffChain extends infer QT
  ? QT extends any
    ? (QT & (WEF extends true ? ExtraFields<QT> : unknown)) extends infer Q
      ? Q & RelayFieldName<Q, Usdc | GT>
      : never
    : never
  : never
>;

export type Quote<SD extends DomainsOf<"Evm">> =
                            QuoteTypeImpl<true, GasTokenOf<SD, DomainsOf<"Evm">>>;
export type UsdcQuote     = QuoteTypeImpl<true>;
export type UsdcQuoteBase = QuoteTypeImpl<false>;
type ErasedQuoteBase      = QuoteTypeImpl<false, GasTokenOf<DomainsOf<"Evm">>>;

export function quoteIsInUsdc(quote: ErasedQuoteBase): quote is UsdcQuote {
  return (
    (quote.type === "offChain" && quote.relayFee.kind.name === "Usdc") ||
    (quote.type === "onChain" && quote.maxRelayFee.kind.name === "Usdc")
  );
}
const definedOrZero = (maybeAddress?: string) =>
  maybeAddress ? new EvmAddress(maybeAddress) : EvmAddress.zeroAddress;

export type CorridorParams<
  N extends Network,
  SD extends SupportedEvmDomain<N>,
  DD extends SupportedDomain<N>,
> = Simplify<Readonly<
  { type: "v1" } | (//eventually, we'll have to check if v1 is supported
  SD extends Exclude<v2.SupportedDomain<N>, "Avalanche">
  ? (DD extends v2.SupportedDomain<N> ? "v2Direct" : "avaxHop") extends
      infer T extends "v2Direct" | "avaxHop"
    ? { type: T; fastFeeRate: Percentage }
    : never
  : never)
>>;

type ErasedCorridorParams =
  CorridorParams<Network, SupportedEvmDomain<Network>, SupportedDomain<Network>>;

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

//"in" is guaranteed to be exact
//"out" will _only_ be exact if:
// * the relay quote is off-chain
// * circle actually consumes the full fast fee
//otherwise, out will always be a bit higher than the specified amount
export type InOrOut = {
  amount: Usdc;
  type: "in" | "out";
};

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
    quote: Quote<SD>,
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
      : totalFeesUsdc.add(this.calcBurnAmount(inOrOut, corridor, quote, gaslessFee));
  }

  transferWithRelay<DD extends SupportedDomain<N>>(
    destination: DD,
    inOrOut: InOrOut, //meaningless distinction, if relay fee is paid in gas and corridor is v1
    mintRecipient: UniversalAddress,
    gasDropoff: GasTokenOf<DD, SupportedDomain<N>>,
    corridor: CorridorParams<N, SD, DD>,
    quote: Quote<SD>,
    permit?: Permit,
  ): ContractTx {
    this.checkCorridorDestinationCoherence(destination, corridor.type);

    const value = evmGasToken(quoteIsInUsdc(quote)
      ? 0n
      : (quote.type === "offChain" ? quote.relayFee : quote.maxRelayFee).toUnit("human"),
    );

    const quoteVariant = (
      quote.type === "offChain"
      ? { type: "offChain",
          expirationTime: quote.expirationTime,
          quoterSignature: quote.quoterSignature,
          feePaymentVariant: quoteIsInUsdc(quote)
            ? { payIn: "usdc", relayFeeUsdc: quote.relayFee }
            : { payIn: "gasToken", relayFeeGasToken: value },
        }
      : quoteIsInUsdc(quote)
      ? { type: "onChainUsdc",
          takeRelayFeeFromInput: inOrOut.type === "in",
          maxRelayFeeUsdc: quote.maxRelayFee,
        }
      : { type: "onChainGas" }
    ) as UserQuoteVariant;

    const burnAmount = this.calcBurnAmount(inOrOut, corridor, quote, usdc(0));

    const inputAmountUsdc = inOrOut.type === "in"
      ? inOrOut.amount
      : burnAmount.add(quoteIsInUsdc(quote) && quote.type === "offChain"
        ? quote.relayFee
        : usdc(0),
      );

    const transfer = {
      ...(permit ? { approvalType: "Permit", permit } : { approvalType: "Preapproval" }),
      inputAmountUsdc,
      destinationDomain: destination as unknown as Transfer<N>["destinationDomain"], //TODO brrr
      mintRecipient,
      gasDropoff: genericGasToken(gasDropoff.toUnit("human")),
      corridorVariant: CctpR.toCorridorVariant(corridor, burnAmount),
      quoteVariant,
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
  ): Permit2TypedData {
    this.checkCorridorDestinationCoherence(destination, corridor.type);
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
          microGasDropoff: gasDropoff.toUnit("human").mul(1000000).floor(),
          corridor: {
            v1:       "CCTPv1" as const,
            v2Direct: "CCTPv2" as const,
            avaxHop:  "CCTPv2->Avalanche->CCTPv1" as const,
          }[corridor.type],
          maxFastFee: erasedCorridor.type === "v1"
            ? 0n
            : CctpR.calcFastFee(burnAmount, erasedCorridor.fastFeeRate).toUnit("atomic"),
          gaslessFee: gaslessFee.toUnit("atomic"),
          maxRelayFee:
            (quote.type === "offChain" ? quote.relayFee : quote.maxRelayFee).toUnit("atomic"),
          quoteSource: quote.type === "offChain" ? "OffChain" : "OnChain",
        },
      },
    } as const;
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
      corridorVariant: CctpR.toCorridorVariant(corridor, burnAmount),
      quoteVariant: (
        quote.type === "offChain"
        ? { type: "offChain",
            expirationTime: quote.expirationTime,
            feePaymentVariant: { payIn: "usdc", relayFeeUsdc: quote.relayFee },
            quoterSignature: quote.quoterSignature,
          }
        : { type: "onChainUsdc",
            maxRelayFeeUsdc: quote.maxRelayFee,
            takeRelayFeeFromInput: inOrOut.type === "in",
          }
      ),
    } as const satisfies Transfer<N>;

    return this.execTx(
      evmGasToken(0),
      serialize(transferLayout(this.client.network), transfer) as CallData,
    );
  }

  private checkCorridorDestinationCoherence(destination: Domain, corridorType: Corridor) {
    assertDistinct(this.client.domain as SupportedDomain<N>, destination);
    const isSupportedV2Domain = v2.isSupportedDomain(this.client.network);

    if (corridorType === "avaxHop") {
      if (([this.client.domain, destination] as string[]).includes("Avalanche"))
        throw new Error("Can't use avaxHop corridor with Avalanche being source or destination");

      if (!isSupportedV2Domain(this.client.domain))
        throw new Error("Can't use avaxHop corridor with non-v2 source domain");

      if (isSupportedV2Domain(destination))
        throw new Error("Don't use avaxHop corridor when destination is also a v2 domain");
    }

    if (corridorType === "v2Direct" && (
        !isSupportedV2Domain(this.client.domain) || !isSupportedV2Domain(destination)
    ))
      throw new Error("Can't use v2 corridor for non-v2 domains");
  }

  private static toCorridorVariant(
    corridor: ErasedCorridorParams,
    burnAmount: Usdc,
  ): CorridorVariant {
    return corridor.type === "v1"
      ? corridor
      : { type: corridor.type,
          maxFastFeeUsdc: CctpR.calcFastFee(burnAmount, corridor.fastFeeRate),
        };
  }

  private calcGaslessAmounts<DD extends SupportedDomain<N>>(
    inOrOut: InOrOut,
    corridor: CorridorParams<N, SD, DD>,
    quote: UsdcQuoteBase,
    gaslessFee: Usdc,
  ): [amount: Usdc, baseAmount: Usdc, burnAmount: Usdc] {
    const burnAmount = this.calcBurnAmount(inOrOut, corridor, quote, gaslessFee);
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

  private calcBurnAmount(
    inOrOut: InOrOut,
    corridor: ErasedCorridorParams,
    quote: ErasedQuoteBase,
    gaslessFee: Usdc,
  ): Usdc {
    //example for inOrOut.type === "out":
    //say desired output on the target chain is 99 µUSDC and the fastFeeRate is 2 %
    //-> need to burn 101.020408163 µUSDC -> ceil to 102 µUSDC
    //this in turn gives a fast fee of:
    //-> 102 µUSDC * 0.02 = 2.04 µUSDC -> ceil to 3 µUSDC => (102 - 3 = 99)

    let burnAmount = inOrOut.amount;
    if (inOrOut.type === "in") {
      burnAmount = burnAmount.sub(gaslessFee);

      //we don't sub the maxRelayFee, because the actual fee might be lower and so we have to assume
      //  the most extreme case, where the actual fee is 0 and hence the burnAmount is maximized
      if (quoteIsInUsdc(quote) && quote.type === "offChain")
        burnAmount = burnAmount.sub(quote.relayFee);
    }
    else if (corridor.type !== "v1")
      burnAmount = CctpR.ceilToMicroUsdc(
        burnAmount.div(Rational.from(1).sub(corridor.fastFeeRate.toUnit("scalar"))),
      );

    if (burnAmount.le(usdc(0)))
      throw new Error("Transfer Amount Less or Equal to 0 After Fees");

    return burnAmount;
  }

  private static calcFastFee(burnAmount: Usdc, fastFeeRate: Percentage): Usdc {
    return CctpR.ceilToMicroUsdc(burnAmount.mul(fastFeeRate.toUnit("scalar")));
  }

  private static ceilToMicroUsdc(amount: Usdc): Usdc {
    return usdc(amount.toUnit("µUSDC").ceil(), "µUSDC");
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
    const serialized = serialize(constructorLayout(network), {
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
    // This padding should be added by serialize but it is not implemented in the layout yet
    const chainDataPostPadding = new Uint8Array(30);
    return encoding.bytes.concat(serialized, chainDataPostPadding);
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
    const messageTransmitterV1 = definedOrZero(v1.contractAddressOf(
      network,
      domain as v1.SupportedDomain<Network>,
      "messageTransmitter",
    ));
    const messageTransmitterV2 = definedOrZero(v2.contractAddressOf(
      network,
      domain as v2.SupportedDomain<Network>,
      "messageTransmitter",
    ));

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
