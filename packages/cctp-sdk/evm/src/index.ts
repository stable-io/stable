// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Network } from "@stable-io/cctp-sdk-definitions";
import * as layoutItems from "./layoutItems.js";
import * as platform from "./platform.js";
import * as utils from "./utils.js";
import * as permit from "./permit.js";

import "./registry.js";

export * from "./address.js";
export * from "./constants.js";
export * from "./layoutItems.js";
export * from "./platform.js";
export * from "./utils.js";
export * from "./permit.js";

/**
 * We need to specify this due to ts(7056):
 * > The inferred type of this node exceeds the maximum length the compiler will serialize.
 * > An explicit type annotation is needed.
 */
type EvmModule<N extends Network> =
  typeof layoutItems &
  typeof platform &
  ReturnType<typeof utils.init<N>> &
  ReturnType<typeof permit.init<N>>;

export const init = <N extends Network>(network: N): EvmModule<N> => ({
  ...layoutItems,
  ...platform,
  ...utils.init(network),
  ...permit.init(network),
} as const);
