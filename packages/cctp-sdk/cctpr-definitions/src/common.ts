import { Simplify } from "@stable-io/map-utils";
import type { Amount, Kind } from "@stable-io/amount";
import { Rational } from "@stable-io/amount";
import type {
  DomainsOf,
  Network,
  Platform,
  Percentage,
  Usdc,
  GasTokenOf,
} from "@stable-io/cctp-sdk-definitions";
import { usdc, mulPercentage, v2 } from "@stable-io/cctp-sdk-definitions";
import type { SupportedDomain, SupportedPlatformDomain } from "./constants.js";
import type { CorridorVariant } from "./layouts.js";

//"in" is guaranteed to be exact
//"out" will _only_ be exact if:
// * the relay quote is off-chain
// * circle actually consumes the full fast fee
//otherwise, out will always be a bit higher than the specified amount
export type InOrOut = {
  amount: Usdc;
  type: "in" | "out";
};

type QtOnChain<A extends Amount<Kind>> =
  { type: "onChain"; maxRelayFee: A };

type QtOffChain<A extends Amount<Kind>, WEF extends boolean> =
  { type: "offChain"; relayFee: A } &
  (WEF extends true ? { expirationTime: Date; quoterSignature: Uint8Array } : unknown);

type QuoteTypeImpl<WEF extends boolean, A extends Amount<Kind>> = //WEF = with extra fields
  Simplify<Readonly<QtOnChain<A> | QtOffChain<A, WEF>>>;

export type QuoteBase<
  N extends Network,
  P extends Platform,
  SD, //SD = source domain
> = [SD] extends [SupportedPlatformDomain<N, P>] //SD = source domain
  ? QuoteTypeImpl<true, Usdc | GasTokenOf<SD, DomainsOf<P>>>
  : never;
export type UsdcQuote     = QuoteTypeImpl<true, Usdc>;
export type UsdcQuoteBase = QuoteTypeImpl<false, Usdc>;
type ErasedQuoteBase      = QuoteTypeImpl<false, any>;

export type CorridorParamsBase<
  N extends Network,
  P extends Platform,
  SD,
  DD extends SupportedDomain<N>,
> = SD extends SupportedPlatformDomain<N, P>
  ? Simplify<Readonly<
      { type: "v1" } | (//eventually, we'll have to check if v1 is supported
      SD extends Exclude<v2.SupportedDomain<N>, "Avalanche">
      ? (DD extends v2.SupportedDomain<N> ? "v2Direct" : "avaxHop") extends
          infer T extends "v2Direct" | "avaxHop"
        ? { type: T; fastFeeRate: Percentage }
        : never
      : never)
    >>
  : never;

//ErasedCorridorParams is intended as a super type of CorridorParamsBase (and its derivatives)
//  the problem with just plucking in the general types like so:
//    CorridorParamsBase<Network, Platform, SupportedDomain<Network>, SupportedDomain<Network>>
//  is that tsc plucks in the concrete types and derives that given then current set of supported
//  domains (Evm and Solana), avaxHop is (currently) not a legitimate choice anymore, because every
//  for Evm and Solana, v2 chains are a proper superset of v1 chains and so v2Direct is the only
//  valid choice.
//On the other hand, when tsc deals with type parameters like DD for the destination domain, it
//  fails to deduce that CorridorParams<..., DD> can't be "avaxHop" and so it fails to deduce that
//  CorridorParams<..., DD> is a subtype of ErasedCorridorParams.
export type ErasedCorridorParams =
  Readonly<{ type: "v1" } | { type: "v2Direct" | "avaxHop"; fastFeeRate: Percentage }>;

export function toCorridorVariant(
  corridor: ErasedCorridorParams,
  burnAmount: Usdc,
): CorridorVariant {
  return corridor.type === "v1"
    ? corridor
    : { type: corridor.type, maxFastFeeUsdc: calcFastFee(burnAmount, corridor.fastFeeRate) };
}

export function quoteIsInUsdc(quote: ErasedQuoteBase): quote is UsdcQuoteBase {
  return (
    (quote.type === "offChain" && quote.relayFee.kind.name === "Usdc") ||
    (quote.type === "onChain" && quote.maxRelayFee.kind.name === "Usdc")
  );
}

export function calcFastFee(burnAmount: Usdc, fastFeeRate: Percentage): Usdc {
  return ceilToMicroUsdc(mulPercentage(burnAmount, fastFeeRate));
}

function calcBurnAmount(
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

    if (burnAmount.le(usdc(0)))
      throw new Error("Transfer amount <= 0 after fees");
  }
  else if (corridor.type !== "v1")
    burnAmount = ceilToMicroUsdc(
      burnAmount.div(Rational.from(1).sub(corridor.fastFeeRate.toUnit("scalar"))),
    );

  return burnAmount;
}

export function calcUsdcAmounts(
  inOrOut: InOrOut,
  corridor: ErasedCorridorParams,
  quote: ErasedQuoteBase,
  gaslessFee: Usdc,
): [totalAmount: Usdc, inputAmount: Usdc, burnAmount: Usdc] {
  if (!quoteIsInUsdc(quote) && gaslessFee.ne(usdc(0)))
    throw new Error("Gasless fee must be 0 if quote is not in USDC");

  const burnAmount = calcBurnAmount(inOrOut, corridor, quote, gaslessFee);
  const [totalAmount, inputAmount] = inOrOut.type === "in"
    ? [ inOrOut.amount,
        inOrOut.amount
          .sub(gaslessFee)
          .sub(quoteIsInUsdc(quote) && quote.type === "offChain" ? quote.relayFee : usdc(0)),
      ]
    : [ burnAmount
          .add(gaslessFee)
          .add(quoteIsInUsdc(quote)
            ? (quote.type === "offChain" ? quote.relayFee : quote.maxRelayFee)
            : usdc(0),
          ),
        burnAmount,
      ];

  if (inputAmount.le(usdc(0)))
    throw new Error("Input amount <= 0");

  return [totalAmount, inputAmount, burnAmount];
}

function ceilToMicroUsdc(amount: Usdc): Usdc {
  return usdc(amount.toUnit("µUSDC").ceil(), "µUSDC");
}
