// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
import { Amount } from "@stable-io/amount";
import { init as initCctpr } from "@stable-io/cctp-sdk-cctpr-definitions";
import type { EvmDomains, Usdc } from "@stable-io/cctp-sdk-definitions";
import { gasTokenKindOf, isUsdc, usdc } from "@stable-io/cctp-sdk-definitions";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { TODO } from "@stable-io/utils";
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
  async (userIntent) => {
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

    const routes: SupportedRoute<N>[] = [];

    for (const corridor of corridors) {
      const userTransferRoute = buildUserTransferRoute(network, intent, corridor);
      const gaslessRoutes = intent.paymentToken === "usdc"
        ? [buildGaslessRoute(viemEvmClient, intent, corridor)]
        : [];

      const corridorRoutes = await Promise.all([
        ...gaslessRoutes,
        userTransferRoute,
      ]);

      routes.push(...corridorRoutes);
    }

    const { fastest, cheapest } = findBestRoutes(routes);

    return {
      all: routes,
      fastest,
      cheapest,
    };
  };

async function getCorridors<N extends Network>(
  network: N,
  cctpr: ReturnType<typeof initCctpr<N>>,
  intent: Intent<keyof EvmDomains, keyof EvmDomains>,
) {
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

function parseIntent(userIntent: UserIntent): Intent<keyof EvmDomains, keyof EvmDomains> {
  return {
    sourceChain: userIntent.sourceChain,
    targetChain: userIntent.targetChain,
    sender: toEvmAddress(userIntent.sender),
    recipient: toEvmAddress(userIntent.recipient),
    amount: parseAmount(userIntent.amount),
    usePermit: userIntent.usePermit ?? true,
    gasDropoffDesired: parseGasDropoff(userIntent),
    paymentToken: userIntent.paymentToken ?? "usdc",
    relayFeeMaxChangeMargin: userIntent.relayFeeMaxChangeMargin ?? RELAY_FEE_MAX_CHANGE_MARGIN,
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

function parseGasDropoff(intent: UserIntent): TODO {
  return Amount.ofKind(gasTokenKindOf(intent.targetChain))(
    intent.gasDropoffDesired ?? 0,
    "atomic",
  );
}

function findBestRoutes<
  S extends keyof EvmDomains,
  D extends keyof EvmDomains,
>(routes: Route<S, D>[]) {
  let fastest: Route<S, D> | undefined;
  let cheapest: Route<S, D> | undefined;

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
