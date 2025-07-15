import type { Domain, Duration, GasTokenOf, Network, Percentage, Usdc, v2 } from "@stable-io/cctp-sdk-definitions";
import type { RoArray, Simplify } from "@stable-io/map-utils";
import type { SupportedDomain } from "./constants.js";
import type { Corridor } from "./layouts.js";

//"in" is guaranteed to be exact
//"out" will _only_ be exact if:
// * the relay quote is off-chain
// * circle actually consumes the full fast fee
//otherwise, out will always be a bit higher than the specified amount
export type InOrOut = {
  amount: Usdc;
  type: "in" | "out";
};

export type SensibleV2Corridor<
  N extends Network,
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
> =
  S extends "Avalanche"
  ? never
  : S extends v2.SupportedDomain<N>
  ? D extends v2.SupportedDomain<N>
    ? "v2Direct"
    : "avaxHop"
  : never;

export type SensibleCorridor<
  N extends Network,
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
> = "v1" | SensibleV2Corridor<N, S, D>;

export type CorridorCost<N extends Network, S extends SupportedDomain<N>> = {
  relay: readonly [usdcCost: Usdc, gasCost: GasTokenOf<S>];
  fast?: Percentage;
};

export type CorridorStats<
  N extends Network,
  S extends SupportedDomain<N>,
  C extends Corridor,
> = {
  corridor: C;
  cost: CorridorCost<N, S>;
  transferTime: Duration;
};

export type Corridors<N extends Network, S extends SupportedDomain<N>, C extends Corridor> = {
  fastBurnAllowance: Usdc;
  stats: RoArray<CorridorStats<N, S, C>>;
};

export type CorridorParams<
  N extends Network,
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
> = Simplify<Readonly<
  { type: "v1" } | (//eventually, we'll have to check if v1 is supported
  S extends Exclude<v2.SupportedDomain<N>, "Avalanche">
  ? (D extends v2.SupportedDomain<N> ? "v2Direct" : "avaxHop") extends
      infer T extends "v2Direct" | "avaxHop"
    ? { type: T; fastFeeRate: Percentage }
    : never
  : never)
>>;

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

export type Quote<S extends Domain> = QuoteTypeImpl<true, GasTokenOf<S>>;
export type UsdcQuote               = QuoteTypeImpl<true>;
export type UsdcQuoteBase           = QuoteTypeImpl<false>;
export type ErasedQuoteBase         = QuoteTypeImpl<false, GasTokenOf<Domain>>;
