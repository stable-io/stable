// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { PlatformCctpr } from "@stable-io/cctp-sdk-cctpr-definitions";
import { registerPlatformCctpr } from "@stable-io/cctp-sdk-cctpr-definitions";
import { getCorridorCosts } from "./getCorridorCosts.js";
import { transfer } from "./transfer.js";

const EvmCctpr: PlatformCctpr<"Evm"> = {
  getCorridorCosts,
  transfer,
};

registerPlatformCctpr("Evm", EvmCctpr);
