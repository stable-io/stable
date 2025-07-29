import { type TODO, assertDistinct } from "@stable-io/utils";
import type { RoArray } from "@stable-io/map-utils";
import type {
  GasTokenOf,
  Duration,
  Network,
  Usdc,
  Percentage,
} from "@stable-io/cctp-sdk-definitions";
import { platformOf, duration, v1, v2 } from "@stable-io/cctp-sdk-definitions";

import { type SupportedDomain, relayOverheadOf } from "./constants.js";
import type { RegisteredCctprPlatform, LoadedCctprPlatformDomain } from "./registry.js";
import { platformCctpr } from "./registry.js";
import type { Corridor } from "./layouts.js";

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

export function getSensibleCorridors<
  N extends Network,
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
): RoArray<SensibleCorridor<N, S, D>> {
  const universalCorridors: RoArray<SensibleCorridor<N, S, D>> = ["v1"];
  return !v2.isSupportedDomain(network)(source) || v2.isFastDomain(source)
    ? universalCorridors
    : [
      ...universalCorridors,
      (v2.isSupportedDomain(network)(destination)
        ? "v2Direct"
        : "avaxHop"
      ) as SensibleCorridor<N, S, D>,
    ];
}

const hopDeliverySeconds = <
  N extends Network,
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
  corridor: SensibleCorridor<N, S, D>,
) =>
  ((corridor === "v1" ? v1 : v2)["attestationTimeEstimates"] as TODO)[network][source] as number +
    relayOverheadOf[network][destination];

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
  duration(hopDeliverySeconds(network, source, destination, corridor) +
    (corridor === "avaxHop"
      ? hopDeliverySeconds(network, "Avalanche", "Avalanche", "v1")
      : 0),
    "sec",
  );

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
): Promise<Corridors<N, S, SensibleCorridor<N, S, D>>> => {
  assertDistinct<SupportedDomain<N>>(source, destination);
  const platform = platformOf(source);
  const cctprImpl = platformCctpr(platform);
  const corridors = getSensibleCorridors(network, source, destination);
  const [{ allowance: fastBurnAllowance }, costs] = await Promise.all([
    v2.fetchFastBurnAllowanceFactory(network)(),
    cctprImpl.getCorridorCosts(network, source, destination, corridors, gasDropoff),
  ]);
  const stats = corridors.map((corridor, i) => ({
    corridor,
    cost: costs[i]!, // @todo: handle undefined
    transferTime: calculateSpeed(network, source, destination, corridor),
  }));
  return {
    fastBurnAllowance,
    stats,
  };
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
