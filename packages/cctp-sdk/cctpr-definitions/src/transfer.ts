// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Amount } from "@stable-io/amount";
import type {
  GasTokenOf,
  Network,
  PlatformAddress,
  UniversalOrNative,
} from "@stable-io/cctp-sdk-definitions";
import {
  Usdc,
  gasTokenKindOf,
  platformAddress,
  platformClient,
  platformOf,
  usdcContracts,
} from "@stable-io/cctp-sdk-definitions";
import type { TODO } from "@stable-io/utils";
import type { SupportedDomain } from "./constants.js";
import { contractAddressOf, gasDropoffLimitOf } from "./constants.js";
import type { RegisteredCctprPlatform, LoadedCctprPlatformDomain } from "./registry.js";
import { platformCctpr } from "./registry.js";
import type { CorridorParams, InOrOut, Quote } from "./types.js";

// export async function* transfer<
//   const S extends SupportedDomain,
//   const D extends SupportedDomain,
//   //... provider<S>,
// >(sourceDomain: S, destinationDomain: D, amount: number):
// Promise<AsyncGenerator<WalletInteractionPrepper<PlatformOf<S>>>> {
//   yield 1;
// }

export const transfer = <
  N extends Network,
  P extends RegisteredCctprPlatform,
  S extends LoadedCctprPlatformDomain<N, P>,
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
  sender: PlatformAddress<P>,
  recipient: UniversalOrNative<SupportedDomain<N>>,
  inOrOut: InOrOut,
  corridor: CorridorParams<N, S, D>,
  quote: Quote<S>,
  gasDropoff: GasTokenOf<D>,
  options: TODO,
): AsyncGenerator<TODO, TODO> => {
  const platform = platformOf(source);
  const gasDropoffLimit = Amount.ofKind(gasTokenKindOf(destination))(
    gasDropoffLimitOf[network][destination],
  );
  if (gasDropoff.gt(gasDropoffLimit as TODO)) {
    throw new Error("Gas Drop Off Limit Exceeded");
  }

  const cctprImpl = platformCctpr(platform);
  return cctprImpl.transfer(
    network,
    source,
    destination,
    sender,
    recipient,
    inOrOut,
    corridor,
    quote,
    gasDropoff,
    options,
  );
};
