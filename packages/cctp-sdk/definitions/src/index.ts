// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import * as address from "./address.js";
import * as api from "./api.js";
import type { Network } from "./constants/index.js";
import * as client from "./client.js";
import * as constants from "./constants/index.js";
import * as layouting from "./layouting.js";
import * as messages from "./messages.js";
import * as protocols from "./protocols/index.js";

export * from "./address.js";
export * from "./api.js";
export * from "./client.js";
export * from "./constants/index.js";
export * from "./layouting.js";
export * from "./layoutItems.js";
export * from "./messages.js";
export * from "./protocols/index.js";
export * from "./registry.js";

export const init = <N extends Network>(network: N) => ({
  ...address,
  ...api,
  ...client,
  ...constants.init(network),
  ...layouting,
  ...messages,
  ...protocols.init(network),
} as const);
