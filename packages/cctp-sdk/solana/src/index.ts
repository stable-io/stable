// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Network } from "@stable-io/cctp-sdk-definitions";
import * as platform from "./platform.js";
import * as layoutItems from "./layoutItems.js";
import * as utils from "./utils.js";

export * from "./address.js";
export * from "./platform.js";
export * from "./layoutItems.js";
export * from "./utils.js";

export const init = <N extends Network>(network: N) => ({
  ...platform,
  ...layoutItems,
  ...utils,
} as const);
