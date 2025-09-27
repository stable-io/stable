// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { privateKeyToAccount } from "viem/accounts";
import { loadPrivateKey } from "../helpers/common.js";
import { Hex } from "viem";

const account = privateKeyToAccount(loadPrivateKey() as Hex);
console.info("Address of WALLET_KEY:", account.address);
