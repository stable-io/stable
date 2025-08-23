// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { TODO } from "@stable-io/utils";
import type { RoArray } from "@stable-io/map-utils";
import type { Network, GasTokenOf } from "@stable-io/cctp-sdk-definitions";
import { genericGasToken, platformClient } from "@stable-io/cctp-sdk-definitions";
import type {
  RelayCost,
  LoadedCctprPlatformDomain,
  SensibleCorridor,
  SupportedDomain,
} from "@stable-io/cctp-sdk-cctpr-definitions";
import type { SolanaClient } from "@stable-io/cctp-sdk-solana";
import { CctpR } from "./contractSdk/index.js";
import { ForeignDomain } from "./contractSdk/constants.js";

export async function getRelayCosts<
  N extends Network,
  S extends LoadedCctprPlatformDomain<N, "Solana">,
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
  corridors: RoArray<SensibleCorridor<N, S, D>>,
  gasDropoff?: GasTokenOf<D, SupportedDomain<N>>,
): Promise<RoArray<RelayCost<N, S>>> {
  const client = platformClient(network, source) as TODO as SolanaClient;
  const cctpr = new CctpR(network, client);
  const gasDropoffRequest = genericGasToken(gasDropoff ? gasDropoff.toUnit("human") : 0);

  const [quotes, solPrice] = await cctpr.quoteOnChainRelay(
    corridors.map(corridor => ({
      corridor,
      gasDropoff: gasDropoffRequest,
      destinationDomain: destination as ForeignDomain<N>,
    })),
  );

  const usdcToSol = solPrice.inv();
  const costs = quotes.map(usdcCost => [usdcCost, usdcCost.convert(usdcToSol)] as const);
  return costs as any;
};
