// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Network } from "@stable-io/cctp-sdk-definitions";
import * as constants from "./constants.js";
import * as getCorridors from "./getCorridors.js";
import * as transfer from "./transfer.js";
import * as layouts from "./layouts.js";

export * from "./constants.js";
export * from "./getCorridors.js";
export * from "./registry.js";
export * from "./transfer.js";
export * from "./layouts.js";

export const init = <N extends Network>(network: N) => ({
  ...constants.init(network),
  ...getCorridors,
  ...transfer,
  ...layouts,
} as const);
