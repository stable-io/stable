// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { DeriveType } from "binary-layout";
import type { Network } from "@stable-io/cctp-sdk-definitions";
import { byteSwitchItem, uint256Item } from "@stable-io/cctp-sdk-definitions";
import { quoteParamsLayout } from "@stable-io/cctp-sdk-cctpr-definitions";

const quoteRelayVariants = <N extends Network>(network: N) => [
  [[0x81, "inUsdc"    ], quoteParamsLayout(network)],
  [[0x82, "inGasToken"], quoteParamsLayout(network)],
] as const;

export const quoteRelayLayout = <N extends Network>(network: N) =>
  byteSwitchItem("quoteRelay", quoteRelayVariants(network));

export type QuoteRelay<N extends Network> = DeriveType<ReturnType<typeof quoteRelayLayout<N>>>;

export const quoteRelayArrayLayout = <N extends Network>(network: N) =>
  ({ binary: "array", layout: quoteRelayLayout(network) } as const);
export const quoteRelayResultLayout = { binary: "array", layout: uint256Item } as const;
