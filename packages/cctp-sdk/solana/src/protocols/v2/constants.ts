// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { type Intersect, difference } from "@stable-io/map-utils";
import type { Network } from "@stable-io/cctp-sdk-definitions";
import { v2 } from "@stable-io/cctp-sdk-definitions";

export const foreignDomains = <N extends Network>(network: N) =>
  difference(v2.supportedDomains(network), ["Solana"]);

type ForeignDomainRet<N extends Network> = ReturnType<typeof foreignDomains<N>>;
type SharedForeignDomain =
  Intersect<ForeignDomainRet<"Mainnet">, ForeignDomainRet<"Testnet">>[number];
export type ForeignDomain<N extends Network> = SharedForeignDomain | ForeignDomainRet<N>[number];
