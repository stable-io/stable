// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Network } from "@stable-io/cctp-sdk-definitions";
import * as cctpAccounts from "./cctpAccounts.js";
import * as constants from "./constants.js";
import * as platform from "./platform.js";
import * as layoutItems from "./layoutItems.js";
import * as utils from "./utils.js";

import "./registry.js";

export * from "./address.js";
export * from "./cctpAccounts.js";
export * from "./constants.js";
export * from "./platform.js";
export * from "./layoutItems.js";
export * from "./utils.js";

export const init = <N extends Network>(network: N) => ({
  ...cctpAccounts,
  ...constants,
  ...platform,
  ...layoutItems,
  ...utils,
} as const);
