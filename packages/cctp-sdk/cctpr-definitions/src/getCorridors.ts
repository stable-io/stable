import type {
  GasTokenOf,
  Duration,
  Network,
  Usdc,
  Percentage,
} from "@stable-io/cctp-sdk-definitions";
import { v2 } from "@stable-io/cctp-sdk-definitions";
import type { RoArray } from "@stable-io/map-utils";

import type { SupportedDomain } from "./constants.js";
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

export type CorridorStats<
  N extends Network,
  S extends SupportedDomain<N>,
  C extends Corridor,
> = {
  corridor: C;
  cost: {
    relay: readonly [usdcCost: Usdc, gasCost: GasTokenOf<S>];
    fast?: Percentage;
  };
  transferTime: Duration;
};

export type Corridors<N extends Network, S extends SupportedDomain<N>, C extends Corridor> = {
  fastBurnAllowance: Usdc;
  stats: RoArray<CorridorStats<N, S, C>>;
};

export const getCorridors = <N extends Network>(network: N) => async function<
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
  //... provider<S>,
  //... circleApi
>(
  sourceDomain: S,
  destinationDomain: D,
  gasDropoff?: GasTokenOf<D>,
): Promise<Corridors<N, S, SensibleCorridor<N, S, D>>> {
  //overloaded: requires amount but only if S is a v2 chain (and not Avalanche)
  //TODO impl
  //check if gas dropoff is supported and below max
  await Promise.resolve();
  throw new Error("Not implemented");
};
