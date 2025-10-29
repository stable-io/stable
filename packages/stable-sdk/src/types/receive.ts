// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Domain } from "@stable-io/cctp-sdk-definitions";
import { TxHash } from "./general.js";

export type Receive = {
  transactionHash: TxHash;
  destinationDomain: Domain;
};
