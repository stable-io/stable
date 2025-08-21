// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Amount } from "@stable-io/amount";
import { init as initCctpr, Corridor, CorridorStats, LoadedCctprDomain, SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";
import type { LoadedDomain, Usdc, Percentage } from "@stable-io/cctp-sdk-definitions";
import { UniversalAddress, gasTokenKindOf, isUsdc, platformAddress, platformOf, usdc, percentage } from "@stable-io/cctp-sdk-definitions";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import type { TODO } from "@stable-io/utils";
import type {
  SDK,
  Route,
  Network,
  Intent,
  UserIntent,
  SupportedRoute,
} from "../../types/index.js";
import { buildGaslessRoute, buildUserTransferRoute } from "./routes/index.js";

export type FindRoutesDeps<N extends Network> = Pick<SDK<N>, "getNetwork" | "getRpcUrl">;

const RELAY_FEE_MAX_CHANGE_MARGIN = 1.02;

export const $findRoutes = <
  N extends Network,
>({
    /**
     * @todo: DI is wrong here. What we need to inject is evm client and cctpr instances
     *        which are created in this function.
     */
    getNetwork,
    getRpcUrl,
  }: FindRoutesDeps<N>): SDK<N>["findRoutes"] =>
  async <S extends LoadedCctprDomain<N>, D extends SupportedDomain<N>>(
    userIntent: UserIntent<N, S, D>,
  ) => {
    const intent = parseIntent(userIntent);
    const network = getNetwork();
    const rpcUrl = getRpcUrl(intent.sourceChain);

    const viemEvmClient = ViemEvmClient.fromNetworkAndDomain(
      network,
      intent.sourceChain,
      rpcUrl,
    );
    const cctpr = initCctpr(network);

    const corridors  = await getCorridors(
      network,
      cctpr,
      intent,
    );

    const routes: SupportedRoute<N, S, D>[] = [];

    for (const corridor of corridors) {
      const userTransferRoute = await buildUserTransferRoute(
        network, intent, corridor,
      );

      if (userTransferRoute !== undefined) {
        routes.push(userTransferRoute);
      }

      if (intent.paymentToken === "usdc") {
        // since gasless has to be paid in a non native token,
        // we only create the gasless route when paymentToken === usdc
        const gaslessRoute = await buildGaslessRoute(
          viemEvmClient as any, // TODO: remove cast
          intent,
          corridor,
        );

        if (gaslessRoute !== undefined) routes.push(gaslessRoute);
      }
    }

    const { fastest, cheapest } = findBestRoutes(routes);

    const result = {
      all: routes,
      fastest,
      cheapest,
    };

    return result;
  };

async function getCorridors<N extends Network>(
  network: N,
  cctpr: ReturnType<typeof initCctpr<N>>,
  intent: Intent<N, LoadedCctprDomain<N>, SupportedDomain<N>>,
): Promise<CorridorStats<N, LoadedCctprDomain<N>, Corridor>[]> {
  const { stats: corridorStats, fastBurnAllowance } = await cctpr.getCorridors(
    network,
    intent.sourceChain,
    intent.targetChain,
    intent.gasDropoffDesired,
  );

  return corridorStats.filter((c) => {
    if (!c.cost.fast) return true;
    return intent.amount.lt(fastBurnAllowance);
  });
}

function parseIntent<N extends Network, S extends LoadedDomain, D extends SupportedDomain<N>>(
  userIntent: UserIntent<N, S, D>,
): Intent<N, S, D> {
  return {
    sourceChain: userIntent.sourceChain,
    targetChain: userIntent.targetChain,
    sender: platformAddress(userIntent.sourceChain, userIntent.sender),
    recipient: new UniversalAddress(
      userIntent.recipient.toString(),
      platformOf(userIntent.targetChain),
    ),
    amount: parseAmount(userIntent.amount),
    usePermit: userIntent.usePermit ?? true,
    gasDropoffDesired: parseGasDropoff(userIntent),
    paymentToken: userIntent.paymentToken ?? "usdc",
    relayFeeMaxChangeMargin: parseRelayFeeChangeMargin(userIntent),
  };
}

function parseAmount(userAmount: string | Usdc): Usdc {
  if (userAmount instanceof Amount && isUsdc(userAmount)) return userAmount;
  if (typeof userAmount === "string") return usdc(userAmount);
  throw new Error(`Unexpected value for amount: ${typeof userAmount}`);
}

function toEvmAddress(address: string | EvmAddress): EvmAddress {
  if (address instanceof EvmAddress) return address;
  if (typeof address === "string") return new EvmAddress(address);
  throw new Error(`Unexpected value for evm address: ${typeof address}`);
}

function parseGasDropoff<
  N extends Network,
  S extends LoadedDomain,
  D extends SupportedDomain<N>,
>(intent: UserIntent<N, S, D>): TODO {
  if (intent.gasDropoffDesired instanceof Amount) return intent.gasDropoffDesired;
  return Amount.ofKind(gasTokenKindOf(intent.targetChain))(
    intent.gasDropoffDesired ?? 0,
    "atomic",
  );
}

function parseRelayFeeChangeMargin<
  N extends Network,
  S extends LoadedDomain,
  D extends SupportedDomain<N>,
>(intent: UserIntent<N, S, D>): Percentage {
  const { relayFeeMaxChangeMargin: rfcm } = intent;
  if (rfcm instanceof Amount) return rfcm;
  if (!rfcm) return percentage(RELAY_FEE_MAX_CHANGE_MARGIN);
  return percentage(rfcm);
}

function findBestRoutes<
  N extends Network,
  S extends LoadedDomain,
  D extends SupportedDomain<N>,
>(routes: Route<N, S, D>[]) {
  let fastest: Route<N, S, D> | undefined;
  let cheapest: Route<N, S, D> | undefined;

  for (const route of routes) {
    if (!fastest || route.estimatedDuration < fastest.estimatedDuration) {
      fastest = route;
    }
    if (!cheapest || route.estimatedTotalCost.lt(cheapest.estimatedTotalCost)) {
      cheapest = route;
    }
  }

  return { fastest: fastest!, cheapest: cheapest! };
}
