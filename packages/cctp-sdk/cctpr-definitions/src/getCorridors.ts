import type {
  Duration,
  GasTokenOf,
  Network,
} from "@stable-io/cctp-sdk-definitions";
import { duration, platformOf, v1, v2 } from "@stable-io/cctp-sdk-definitions";
import type { RoArray } from "@stable-io/map-utils";
import type { TODO } from "@stable-io/utils";
import { assertDistinct } from "@stable-io/utils";
import * as cctpr from "./constants.js";

import type { SupportedDomain } from "./constants.js";
import type { LoadedCctprPlatformDomain, RegisteredCctprPlatform } from "./registry.js";
import { platformCctpr } from "./registry.js";
import type { Corridors, SensibleCorridor } from "./types.js";

const getSensibleCorridors = <
  N extends Network,
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
): RoArray<SensibleCorridor<N, S, D>> => {
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
};

const calculateSpeed = <
  N extends Network,
  S extends SupportedDomain<N>,
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
  corridor: SensibleCorridor<N, S, D>,
): Duration => {
  return duration(
    (() => {
      switch (corridor) {
        case "v1":
          return (v1.attestationTimeEstimates[network] as TODO)[source] as number;
        case "v2Direct":
          return (v2.attestationTimeEstimates[network] as TODO)[source] as number;
        case "avaxHop":
          return (v2.attestationTimeEstimates[network] as TODO)[source] as number
            + cctpr.relayOverheadOf[network]["Avalanche"]
            + v1.attestationTimeEstimates[network]["Avalanche"];
        default:
          throw new Error("Invalid corridor");
      }
    })() + ((cctpr.relayOverheadOf[network] as TODO)[destination] as number),
    "sec",
  );
};

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
  const platform = platformOf.get(source)! as P;
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
