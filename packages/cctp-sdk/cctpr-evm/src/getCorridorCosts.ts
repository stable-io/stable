// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Text, TODO } from "@stable-io/utils";
import { assertEqual } from "@stable-io/utils";
import type { RoArray } from "@stable-io/map-utils";
import type { Network, GasTokenOf } from "@stable-io/cctp-sdk-definitions";
import { genericGasToken, platformClient } from "@stable-io/cctp-sdk-definitions";
import type {
  CorridorCost,
  LoadedCctprPlatformDomain,
  SensibleCorridor,
  SupportedDomain,
} from "@stable-io/cctp-sdk-cctpr-definitions";
import * as cctpr from "@stable-io/cctp-sdk-cctpr-definitions";
import type { EvmClient } from "@stable-io/cctp-sdk-evm";
import type { QuoteRelay } from "./contractSdk/layouts/index.js";
import { CctpR as CctpRContract } from "./contractSdk/index.js";

export async function getCorridorCosts<
  N extends Network,
  S extends LoadedCctprPlatformDomain<N, "Evm">,
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
  corridors: RoArray<SensibleCorridor<N, S, D>>,
  gasDropoff?: GasTokenOf<D, SupportedDomain<N>>,
): Promise<RoArray<CorridorCost<N, S>>> {
  const client = platformClient(network, source) as TODO as EvmClient<N, S>;
  const cctprContract = new CctpRContract(client);
  const gasDropoffRequest = genericGasToken(gasDropoff ? gasDropoff.toUnit("human") : 0);

  const gasDropoffLimit = genericGasToken(
    cctpr.gasDropoffLimitOf[network][destination],
  );
  if (gasDropoffRequest.gt(gasDropoffLimit))
    throw new Error("Gas Drop Off Limit Exceeded");

  const fastCostsPromise = Promise.all(corridors.map(corridor =>
    corridor === "v1"
      ? undefined
      : cctpr.getFastCost(network, source, destination, corridor),
  ));

  const variants = ["inUsdc", "inGasToken"] as const satisfies RoArray<QuoteRelay<N>["quoteRelay"]>;
  const quoteRelays = corridors.flatMap(corridor => variants.map(variant => ({
    quoteRelay: variant,
    destinationDomain: destination,
    corridor,
    gasDropoff: gasDropoffRequest,
  })));
  const allQuotesPromise = cctprContract.quoteOnChainRelay(
    quoteRelays as unknown as RoArray<QuoteRelay<N>>, // @todo: remove cast
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

  const costs = corridors.map((_, i) => {
    const quotesIndex = i * variants.length;
    const [usdcCost, gasCost] = allQuotes.slice(quotesIndex, quotesIndex + variants.length);
    const relay = [usdcCost!, gasCost!] as const;
    const fastCost = fastCosts[i];
    return (fastCost ? { relay, fast: fastCost } : { relay });
  });
  return costs as RoArray<CorridorCost<N, S>>; // @todo: remove cast
};
