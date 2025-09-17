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
} from "@stable-io/cctp-sdk-definitions";

import type { Fee, Network, Intent } from "../../types/index.js";
import { RouteExecutionStep } from "./steps.js";
import { getDomainPrices } from "../../api/oracle.js";

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
  let gasTokenPriceUsdc: Usdc;

  if (domain === "Solana") {
    const domainPrices = await getDomainPrices(network, { domain, network });
    gasTokenPriceUsdc = usdc(domainPrices.gasTokenPriceAtomicUsdc, "atomic");
    // TODO: Add the step cost for solana
    totalCost.add(usd(0));
  } else {
    const domainPrices = await getDomainPrices(network, { domain, network });
    const gasTokenKind = gasTokenKindOf(domain);
    gasTokenPriceUsdc = usdc(domainPrices.gasTokenPriceAtomicUsdc, "atomic");
    const stepsCost = steps.reduce((subtotal, step) => {
      const gasTokenCost: Amount<typeof gasTokenKind> = gasTokenOf(domain)(
        domainPrices.gasPriceAtomic,
        "atomic",
      ).mul(step.gasCostEstimation);

      const gasTokenPrice = Conversion.from<
        Usd["kind"],
        GasTokenKindOf<typeof domain>
      >(usd(gasTokenPriceUsdc.toUnit("human")), gasTokenKind);
      const usdCost = gasTokenCost.convert(gasTokenPrice);
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
