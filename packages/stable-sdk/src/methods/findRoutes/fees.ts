// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Amount, Conversion } from "@stable-io/amount";
import type {
  Corridor,
  CorridorStats,
  LoadedCctprPlatformDomain,
  SupportedDomain,
} from "@stable-io/cctp-sdk-cctpr-definitions";
import {
  GasTokenKindOf,
  Usdc,
  usd,
  Usd,
  gasTokenKindOf,
  gasTokenOf,
  Percentage,
  percentage,
  RegisteredPlatform,
  usdc,
  type Sol,
  sol,
} from "@stable-io/cctp-sdk-definitions";

import type { Fee, Network, Intent } from "../../types/index.js";
import { EvmCostEstimation, RouteExecutionStep, SolanaCostEstimation } from "./steps.js";
import { EvmDomainPrices, getDomainPrices, SolanaDomainPrices } from "../../api/oracle.js";

export function getCorridorFees<
  N extends Network,
  P extends RegisteredPlatform,
  S extends LoadedCctprPlatformDomain<N, P>,
  D extends SupportedDomain<N>,
>(
  corridorCost: CorridorStats<N, D, Corridor>["cost"],
  intent: Intent<N, S, D>,
): { corridorFees: Fee[]; maxRelayFee: Fee; fastFeeRate: Percentage } {
  const corridorFees = [] as Fee[];

  const relayFee: Fee = intent.paymentToken === "usdc"
    ? corridorCost.relay[0]
    : corridorCost.relay[1] as Fee;

  const maxRelayFee = relayFee.mul(intent.relayFeeMaxChangeMargin.toUnit("%"));

  corridorFees.push(maxRelayFee);
  let fastFeeRate: Percentage = percentage(0);

  if (corridorCost.fast !== undefined) {
    fastFeeRate =  corridorCost.fast;
  }

  return { corridorFees, maxRelayFee, fastFeeRate };
}

export async function calculateTotalCost(
  network: Network,
  steps: RouteExecutionStep[],
  fees: Fee[],
): Promise<Usd> {
  const domain = steps[0].chain;
  // @todo: get the USDC price from the oracle
  const usdPerUsdc = 1;
  const usdcPrice = Conversion.from(usd(usdPerUsdc), Usdc);
  const totalCost = usd(0);
  const avaxPrices = await getDomainPrices(network, { domain: "Avalanche", network });
  let gasTokenPriceUsdc: Usdc;

  if (domain === "Solana") {
    const domainPrices = await getDomainPrices(network, { domain, network });
    const gasTokenKind = gasTokenKindOf(domain);
    gasTokenPriceUsdc = usdc(domainPrices.gasTokenPriceAtomicUsdc, "atomic");
    const stepsCost = steps.reduce((subtotal, step) => {
      const costEstimation = step.costEstimation.sourceChain as SolanaCostEstimation;
      const totalSolCost = getTotalSolCost(domainPrices, costEstimation);
      const gasTokenPrice = Conversion.from<
        Usd["kind"],
        GasTokenKindOf<typeof domain>
      >(usd(gasTokenPriceUsdc.toUnit("human")), gasTokenKind);
      const usdCost = totalSolCost.convert(gasTokenPrice);

      if (step.costEstimation.hopChain !== undefined)
        usdCost.add(getUsdCostEvm(
          "Avalanche",
          gasTokenKindOf("Avalanche"),
          step.costEstimation.hopChain,
          avaxPrices,
        ));

      return subtotal.add(usdCost);
    }, usd(0));
    totalCost.add(stepsCost);
  } else {
    const domainPrices = await getDomainPrices(network, { domain, network });
    const gasTokenKind = gasTokenKindOf(domain);
    gasTokenPriceUsdc = usdc(domainPrices.gasTokenPriceAtomicUsdc, "atomic");
    const stepsCost = steps.reduce((subtotal, step) => {
      const usdCost = getUsdCostEvm(
        domain,
        gasTokenKind,
        step.costEstimation.sourceChain as EvmCostEstimation,
        domainPrices,
      );

      if (step.costEstimation.hopChain !== undefined)
        usdCost.add(getUsdCostEvm(
          "Avalanche",
          gasTokenKindOf("Avalanche"),
          step.costEstimation.hopChain,
          avaxPrices,
        ));

      return subtotal.add(usdCost);
    }, usd(0));
    totalCost.add(stepsCost);
  }

  const feesCost = fees.reduce((subtotal, fee) => {
    const conversion: Conversion<Usd["kind"], typeof fee.kind> =
      fee.kind.name === "Usdc"
        ? usdcPrice
        : Conversion.from<Usd["kind"], typeof fee.kind>(
            usd(gasTokenPriceUsdc.toUnit("human")),
            fee.kind,
          );
    const usdCost: Usd = (fee as Amount<typeof fee.kind>).convert(conversion);
    return subtotal.add(usdCost);
  }, usd(0));

  return totalCost.add(feesCost);
}

function getUsdCostEvm(
  domain: SupportedDomain<Network>,
  gasTokenKind: GasTokenKindOf<typeof domain>,
  costEstimation: EvmCostEstimation,
  domainPrices: EvmDomainPrices,
): Usd {
  const gasTokenPriceUsdc = usdc(domainPrices.gasTokenPriceAtomicUsdc, "atomic");
  const gasTokenCost: Amount<typeof gasTokenKind> = gasTokenOf(domain)(
    domainPrices.gasPriceAtomic,
    "atomic",
  ).mul(costEstimation.gasCostEstimation);

  const gasTokenPrice = Conversion.from<
    Usd["kind"],
    GasTokenKindOf<typeof domain>
  >(usd(gasTokenPriceUsdc.toUnit("human")), gasTokenKind);
  return gasTokenCost.convert(gasTokenPrice);
};

export function getTotalSolCost(
  domainPrices: SolanaDomainPrices,
  costEstimation: SolanaCostEstimation,
): Sol {
  const computationCost = sol(
    domainPrices.computationPriceAtomicMicroLamports,
    "atomic",
  ).div(1_000_000n).mul(costEstimation.computationUnits);
  const signatureCost = sol(
    domainPrices.signaturePriceAtomicLamports,
    "atomic",
  ).mul(BigInt(costEstimation.signatures));
  const accountCost = sol(
    domainPrices.pricePerAccountByteAtomicLamports,
    "atomic",
  ).mul(costEstimation.accountBytes);
  return computationCost.add(signatureCost).add(accountCost);
}
