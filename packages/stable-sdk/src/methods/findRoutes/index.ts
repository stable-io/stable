// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";
import type {
  SupportedEvmDomain,
} from "@stable-io/cctp-sdk-cctpr-evm";
import {
  GasTokenOf,
} from "@stable-io/cctp-sdk-definitions";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { TODO } from "@stable-io/utils";

import { getCorridorFees } from "./fees.js";

import { buildGaslessRelayerRoute } from "./routes/gasless.js";

import type {
  SDK,
  Route,
  Network,
  Intent,
} from "../../types/index.js";

/**
 * @todo: no need to use bigint for gas units
 */
const EVM_APPROVAL_TX_GAS_COST_APROXIMATE = 40000n;
/**
 * @todo: this probably makes more sense in BPS?
 */
const RELAY_FEE_MAX_CHANGE_MARGIN = 1.02;

export type FindRoutesDeps<N extends Network> = Pick<SDK<N>, "getNetwork" | "getRpcUrl">;

export const $findRoutes =
  <N extends Network>({
    getNetwork,
    getRpcUrl,
  }: FindRoutesDeps<N>): SDK<N>["findRoutes"] =>
  async (intent, routeSearchOptions) => {
    const payInUsdc = (routeSearchOptions.paymentToken ?? "usdc") === "usdc";

    const network = getNetwork();
    const rpcUrl = getRpcUrl(intent.sourceChain);

    const viemEvmClient = ViemEvmClient.fromNetworkAndDomain(
      network,
      intent.sourceChain,
      rpcUrl,
    );

    const gasDropoff = parseGasDropoff(intent) as GasTokenOf<SupportedDomain<N>>;
    


    const corridorStats  = await getCorridors(
      viemEvmClient,
      intent,
      gasDropoff as TODO
    );

    const routes: Route[] = [];

    for (const corridor of corridorStats) {
      const { corridorFees, maxRelayFee, maxFastFeeUsdc } = getCorridorFees(
        corridor.cost,
        usdc(intent.amount),
        payInUsdc,
        routeSearchOptions.relayFeeMaxChangeMargin,
      );

      const estimatedDuration = corridor.transferTime.toUnit("sec").toNumber();

      const gaslessRoutes = payInUsdc ? [] : [await buildGaslessRelayerRoute()];
      const permitRoute = await buildPermitRoute();
      const approvalRoute = await buildApprovalRoute();

      const corridorRoutes = await Promise.all([
        ...gaslessRoutes,
        permitRoute,
        approvalRoute,
      ]);

      routes.push(...corridorRoutes);
    }

    const { fastest, cheapest } = getBestRoutes(routes);

    return {
      all: routes,
      fastest: fastest,
      cheapest: cheapest,
    };
  };

async function getCorridors<
  N extends Network,
  S extends SupportedEvmDomain<N>
> (
  viemEvmClient: ViemEvmClient<N,S>,
  intent: Intent,
  gasDropoff: TODO,
) {
  const cctprEvm = initCctprEvm(viemEvmClient.network);

  const { stats: corridorStats, fastBurnAllowance } =
    await cctprEvm.getCorridors(viemEvmClient, intent.targetChain, gasDropoff);

  return corridorStats.filter((c) => {
    if (!c.cost.fast) return true;
    return usdc(intent.amount).ge(fastBurnAllowance)
  });
}

function parseGasDropoff(intent: Intent): TODO {
  return Amount.ofKind(gasTokenKindOf(intent.targetChain))(
    intent.gasDropoffDesired ?? 0,
    "atomic",
  );
}

function getBestRoutes(routes: Route[]) {
  let fastest: Route | undefined;
  let cheapest: Route | undefined;

  for (const route of routes) {
    if (!fastest || route.estimatedDuration < fastest.estimatedDuration) {
      fastest = route;
    }
    if (!cheapest || route.estimatedTotalCost.lt(cheapest.estimatedTotalCost)) {
      cheapest = route;
    }
  }

  return { fastest, cheapest };
}
