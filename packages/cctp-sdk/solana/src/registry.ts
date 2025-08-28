// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { registerPlatformAddress } from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress } from "./address.js";
import type { SolanaClient, TxMsg, SignableTx } from "./platform.js";

declare module "@stable-io/cctp-sdk-definitions" {
  export interface PlatformRegistry {
    Solana: {
      Client: SolanaClient;
      Address: SolanaAddress;
      UnsignedTx: TxMsg;
      UnsignedMsg: SignableTx;
    };
  }
}

registerPlatformAddress("Solana", SolanaAddress);
