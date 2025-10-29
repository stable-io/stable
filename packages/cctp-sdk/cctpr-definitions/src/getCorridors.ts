// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { type TODO, Url, assertDistinct } from "@stable-io/utils";
import type { RoArray } from "@stable-io/map-utils";
import type {
  GasTokenOf,
  Duration,
  Network,
  Usdc,
  Percentage,
} from "@stable-io/cctp-sdk-definitions";
import { platformOf, duration, v1, v2, genericGasToken } from "@stable-io/cctp-sdk-definitions";

import { type SupportedDomain, gasDropoffLimitOf, relayOverheadOf } from "./constants.js";
import type { RegisteredCctprPlatform, LoadedCctprPlatformDomain } from "./registry.js";
import { platformCctpr } from "./registry.js";
import type { Corridor } from "./layouts.js";

type SupportedV1Corridor<
  N extends Network,
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
> = S extends v1.SupportedDomain<N>
  ? D extends v1.SupportedDomain<N>
    ? "v1"
    : never
  : never;

type SensibleV2Corridor<
  N extends Network,
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
> = S extends v2.SupportedDomain<N>
  ? D extends v2.SupportedDomain<N>
    ? S extends v2.FastDomain
      ? D extends v1.SupportedDomain<N>
        ? never //no point using v2 if S is fast and D supports v1
        : "v2Direct"
      : "v2Direct"
    : "avaxHop" //for D to be supported, it must support either v1 or v2
  : never;

export type SensibleCorridor<
  N extends Network,
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
> = SupportedV1Corridor<N, S, D> | SensibleV2Corridor<N, S, D>;

export type RelayCost<N extends Network, S extends SupportedDomain<N>> =
  readonly [usdcCost: Usdc, gasCost: GasTokenOf<S>];

export type CorridorCost<N extends Network, S extends SupportedDomain<N>> = {
  relay: RelayCost<N, S>;
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

export async function getFastCost<
  N extends Network,
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
  corridor: SensibleV2Corridor<N, S, D>,
): Promise<Percentage> {
  const fastBurnDestination = corridor === "avaxHop" ? "Avalanche" : destination;
  const { minimumFee } = await v2.fetchFastBurnFeeFactory(network)(source, fastBurnDestination);
  return minimumFee;
}

type AllSensibleCorridors<
  N extends Network,
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
> = (
  SensibleV2Corridor<N, S, D> extends infer V2
  ? "v1" extends SupportedV1Corridor<N, S, D>
    ? V2 extends never
      ? ["v1"]
      : ["v1", V2]
    : [V2]
  : never
) extends infer R extends RoArray<SensibleCorridor<N, S, D>> ? R : never;

export function getSensibleCorridors<
  N extends Network,
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
): AllSensibleCorridors<N, S, D> {
  const v1IsSupported = v1.isSupportedDomain(network);
  const v2IsSupported = v2.isSupportedDomain(network);
  return [
    ...(v1IsSupported(source) && v1IsSupported(destination) ? ["v1"] : []),
    ...(!v2IsSupported(source) || (v2.isFastDomain(source) && v1IsSupported(destination))
      ? []
      : v2IsSupported(destination)
      ? ["v2Direct"]
      : ["avaxHop"]
    ),
  ] as unknown as AllSensibleCorridors<N, S, D>;
}

const hopDeliveryTime = <
  N extends Network,
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
  version: "v1" | "v2",
) =>
  duration(
    ((version === "v1" ? v1 : v2)["attestationTimeEstimates"] as TODO)[network][source] as number +
      relayOverheadOf[network][destination],
    "sec",
  );

export const calculateSpeed = <
  N extends Network,
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
  corridor: SensibleCorridor<N, S, D>,
): Duration =>
  corridor === "avaxHop"
  ? hopDeliveryTime(network, source, "Avalanche", "v2")
      .add(hopDeliveryTime(network, "Avalanche", destination, "v1"))
  : hopDeliveryTime(network, source, destination, corridor === "v1" ? "v1" : "v2");

export const getCorridors = async <
  N extends Network,
  P extends RegisteredCctprPlatform,
  S extends LoadedCctprPlatformDomain<N, P>,
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
  gasDropoff?: GasTokenOf<D>,
  rpcUrl?: Url,
): Promise<Corridors<N, S, SensibleCorridor<N, S, D>>> => {
  assertDistinct<SupportedDomain<N>>(source, destination);
  const platform = platformOf(source);
  const cctprImpl = platformCctpr(platform);
  const corridors = getSensibleCorridors(network, source, destination);

  const gasDropoffRequest = genericGasToken(gasDropoff ? gasDropoff.toUnit("human") : 0);

  const gasDropoffLimit = genericGasToken(
    gasDropoffLimitOf[network][destination],
  );
  if (gasDropoffRequest.gt(gasDropoffLimit))
    throw new Error("Gas Drop Off Limit Exceeded");

  const fastCostsPromise = Promise.all(corridors.map(corridor =>
    corridor === "v1"
      ? undefined
      : getFastCost(network, source, destination, corridor),
  ));

  const [{ allowance: fastBurnAllowance }, fastCosts, relayCosts] = await Promise.all([
    v2.fetchFastBurnAllowanceFactory(network)(),
    fastCostsPromise,
    cctprImpl.getRelayCosts(network, source, destination, corridors, gasDropoff, rpcUrl),
  ]);
  const stats = corridors.map((corridor, i) => ({
    corridor,
    cost: { relay: relayCosts[i]!, ...(fastCosts[i] ? { fast: fastCosts[i] } : {}) },
    transferTime: calculateSpeed(network, source, destination, corridor),
  })) as RoArray<CorridorStats<N, S, SensibleCorridor<N, S, D>>>;

  return { fastBurnAllowance, stats };
};

export function checkIsSensibleCorridor<N extends Network>(
  network: N,
  source: SupportedDomain<N>,
  destination: SupportedDomain<N>,
  corridorType: Corridor,
): void {
  assertDistinct(source, destination);
  const isSupportedV2Domain = v2.isSupportedDomain(network);

  if (corridorType === "avaxHop") {
    if (([source, destination] as string[]).includes("Avalanche"))
      throw new Error("Can't use avaxHop corridor with Avalanche being source or destination");

    if (!isSupportedV2Domain(source))
      throw new Error("Can't use avaxHop corridor with non-v2 source domain");

    if (isSupportedV2Domain(destination))
      throw new Error("Don't use avaxHop corridor when destination is also a v2 domain");
  }

  if (corridorType === "v2Direct" && (
      !isSupportedV2Domain(source) || !isSupportedV2Domain(destination)
  ))
    throw new Error("Can't use v2 corridor for non-v2 domains");
}
