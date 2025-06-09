// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Amount, Conversion } from "@stable-io/amount";
import type { SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";
import { init as initCctpr } from "@stable-io/cctp-sdk-cctpr-definitions";
import type {
  Corridor,
  CorridorStats,
  SupportedEvmDomain,
} from "@stable-io/cctp-sdk-cctpr-evm";
import {
  init as initCctprEvm,
} from "@stable-io/cctp-sdk-cctpr-evm";
import {
  init as initDefinitions,
  EvmDomains,
  GasTokenKindOf,
  GasTokenNameOf,
  GasTokenOf,
  Usdc,
  usdc,
  usd,
  Usd,
  gasTokenKindOf,
  gasTokenNameOf,
  gasTokenOf,
} from "@stable-io/cctp-sdk-definitions";
import { EvmAddress, init as initEvm } from "@stable-io/cctp-sdk-evm";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { TODO } from "@stable-io/utils";

import { TransferProgressEmitter } from "../../progressEmitter.js";
import { TransactionEmitter } from "../../transactionEmitter.js";
import { transferWithGaslessRelaying } from "../../gasless/transfer.js";

import type {
  Fee,
  SDK,
  Route,
  RouteExecutionStep,
  Network,
  Intent,
} from "../../types/index.js";

/**
 * @todo: this probably makes more sense in BPS?
 */
const RELAY_FEE_MAX_CHANGE_MARGIN = 1.02;

export function getCorridorFees<N extends Network, S extends keyof EvmDomains>(
  corridorCost: CorridorStats<N, S, Corridor>["cost"],
  intendedAmount: Usdc,
  payInUsdc: boolean,
  relayFeeMaxChangeMargin?: number,
): { corridorFees: Fee[]; maxRelayFee: Fee; maxFastFeeUsdc?: Usdc } {
  const corridorFees = [] as Fee[];

  const relayFee: Fee = payInUsdc
    ? corridorCost.relay[0]
    : corridorCost.relay[1] as GasTokenOf<keyof EvmDomains>;

  const maxChangeMargin = relayFeeMaxChangeMargin ?? RELAY_FEE_MAX_CHANGE_MARGIN;
  const maxRelayFee = relayFee.mul(maxChangeMargin);

  corridorFees.push(maxRelayFee);
  let maxFastFeeUsdc: Usdc | undefined = undefined;

  if (corridorCost.fast !== undefined) {
    /**
     * If the corridor has the "fast" option, then we assume it
     * will be used.
     * Hence we add the fast cost to the fees.
     * See comment above `findRoutes` method for more info.
     */
    const percentage = corridorCost.fast.toUnit("whole");
    maxFastFeeUsdc = usdc(intendedAmount.mul(percentage).toUnit("µUSDC").ceil(), "µUSDC");
    corridorFees.push(maxFastFeeUsdc);
  }

  return { corridorFees, maxRelayFee, maxFastFeeUsdc };
}


// eslint-disable-next-line @typescript-eslint/require-await
export async function calculateTotalCost(
  steps: RouteExecutionStep[],
  fees: Fee[],
): Promise<Usd> {
  // @todo: get the gas token price from the oracle
  const usdPerGasToken: Readonly<
    Record<GasTokenNameOf<keyof EvmDomains>, number>
  > = {
    Eth: 2587.19,
    Avax: 25.59,
    Pol: 0.2533,
    Sonic: 0.5861,
  };
  // @todo: get the USDC price from the oracle
  const usdPerUsdc = 1;
  const usdcPrice = Conversion.from(usd(usdPerUsdc), Usdc);
  // @todo: get the gas price from the oracle
  const gasPrice = 10_300_000_000n;

  const stepsCost = steps.reduce((subtotal, step) => {
    const domain = step.chain;
    const gasTokenKind = gasTokenKindOf(domain);
    const gasTokenPrice = Conversion.from<
      Usd["kind"],
      GasTokenKindOf<typeof domain>
    >(usd(usdPerGasToken[gasTokenNameOf(domain)]), gasTokenKind);
    const gasTokenCost: Amount<typeof gasTokenKind> = gasTokenOf(domain)(
      gasPrice,
      "atomic",
    ).mul(step.gasCostEstimation);
    const usdCost = gasTokenCost.convert(gasTokenPrice);
    return subtotal.add(usdCost);
  }, usd(0));

  const feesCost = fees.reduce((subtotal, fee) => {
    const conversion: Conversion<Usd["kind"], typeof fee.kind> =
      fee.kind.name === "Usdc"
        ? usdcPrice
        : Conversion.from<Usd["kind"], typeof fee.kind>(
            usd(usdPerGasToken[fee.kind.name]),
            fee.kind,
          );
    const usdCost: Usd = (fee as Amount<typeof fee.kind>).convert(conversion);
    return subtotal.add(usdCost);
  }, usd(0));

  return stepsCost.add(feesCost);
}