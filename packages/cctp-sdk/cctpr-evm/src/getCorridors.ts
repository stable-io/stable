// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { CorridorStats, Corridors, SensibleCorridor, SensibleV2Corridor, SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";
import * as cctpr from "@stable-io/cctp-sdk-cctpr-definitions";
import type {
  GasTokenOf,
  Duration,
  Network,
  Percentage,
} from "@stable-io/cctp-sdk-definitions";
import { duration, v1, v2, genericGasToken } from "@stable-io/cctp-sdk-definitions";
import type { EvmClient } from "@stable-io/cctp-sdk-evm";
import type { Text, TODO } from "@stable-io/utils";
import { assertDistinct, assertEqual } from "@stable-io/utils";
import type { RoArray } from "@stable-io/map-utils";
import type { QuoteRelay } from "./contractSdk/layouts/index.js";
import { type SupportedEvmDomain, CctpR as CctpRContract } from "./contractSdk/index.js";

async function getFastCost<
  N extends Network,
  S extends SupportedEvmDomain<N>,
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

function getSensibleCorridors<
  N extends Network,
  S extends SupportedEvmDomain<N>,
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
  S extends SupportedEvmDomain<N>,
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
  corridor: SensibleCorridor<N, S, D>,
) =>
  ((corridor === "v1" ? v1 : v2)["attestationTimeEstimates"] as TODO)[network][source] as number +
    cctpr.relayOverheadOf[network][destination];

const calculateSpeed = <
  N extends Network,
  S extends SupportedEvmDomain<N>,
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

async function getCorridorStats<
  N extends Network,
  S extends SupportedEvmDomain<N>,
  D extends SupportedDomain<N>,
>(
  network: N,
  cctprContract: CctpRContract<N, S>,
  destination: D,
  corridors: RoArray<SensibleCorridor<N, S, D>>,
  gasDropoff?: GasTokenOf<D, SupportedDomain<N>>,
): Promise<RoArray<CorridorStats<N, S, SensibleCorridor<N, S, D>>>> {
  const gasDropoffRequest = genericGasToken(gasDropoff ? gasDropoff.toUnit("human") : 0);

  const gasDropoffLimit = genericGasToken(
    cctpr.gasDropoffLimitOf[network][destination],
  );
  if (gasDropoffRequest.gt(gasDropoffLimit))
    throw new Error("Gas Drop Off Limit Exceeded");

  const source = cctprContract.client.domain;
  const fastCostsPromise = Promise.all(corridors.map(corridor =>
    corridor === "v1"
      ? undefined
      : getFastCost(network, source, destination, corridor),
  ));

  const variants = ["inUsdc", "inGasToken"] as const satisfies RoArray<QuoteRelay<N>["quoteRelay"]>;
  const quoteRelays = corridors.flatMap(corridor => variants.map(variant => ({
    quoteRelay: variant,
    destinationDomain: destination,
    corridor,
    gasDropoff: gasDropoffRequest,
  })));
  const allQuotesPromise = cctprContract.quoteOnChainRelay(
    quoteRelays as unknown as RoArray<QuoteRelay<N>>, //TODO all this ugly casting...
  );
  const [
    fastCosts,
    allQuotes,
  ] = await Promise.all([fastCostsPromise, allQuotesPromise]);

  assertEqual(
    allQuotes.length,
    corridors.length * variants.length,
    "Invalid number of quotes" as Text,
  );

  const stats = corridors.map((corridor, i) => {
    const quotesIndex = i * variants.length;
    const [usdcCost, gasCost] = allQuotes.slice(quotesIndex, quotesIndex + variants.length);
    const costWithRelay = { relay: [usdcCost!, gasCost!] } as const;
    const fastCost = fastCosts[i];
    const cost = (fastCost ? { ...costWithRelay, fast: fastCost } : costWithRelay) as
      CorridorStats<N, S, SensibleCorridor<N, S, D>>["cost"];
    const transferTime = calculateSpeed(network, source, destination, corridor);
    return {
      corridor,
      cost,
      transferTime,
    };
  });
  return [...stats];
}

export const getCorridors = <N extends Network>() =>
  async function<
    S extends SupportedEvmDomain<N>,
    D extends SupportedDomain<N>,
    >(
      client: EvmClient<N, S>,
      destination: D,
      gasDropoff?: GasTokenOf<D>,
    ): Promise<Corridors<N, S, SensibleCorridor<N, S, D>>> {
    const network = client.network;
    const source = client.domain;
    assertDistinct<SupportedDomain<N>>(source, destination);
    const corridors = getSensibleCorridors(network, source, destination);
    const cctprContract = new CctpRContract(client);
    const [{ allowance: fastBurnAllowance }, stats] = await Promise.all([
      v2.fetchFastBurnAllowanceFactory(network)(),
      getCorridorStats(
        network,
        cctprContract,
        destination,
        corridors,
        gasDropoff,
      ),
    ]);
    return {
      fastBurnAllowance,
      stats,
    };
  };
