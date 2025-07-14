// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { SupportedDomain } from "./constants.js";
import type {
  Usdc,
  GasTokenOf,
  Duration,
  Network,
  Percentage,
} from "@stable-io/cctp-sdk-definitions";

// export async function* transfer<
//   const S extends SupportedDomain,
//   const D extends SupportedDomain,
//   //... provider<S>,
// >(sourceDomain: S, destinationDomain: D, amount: number):
// Promise<AsyncGenerator<WalletInteractionPrepper<PlatformOf<S>>>> {
//   yield 1;
// }
