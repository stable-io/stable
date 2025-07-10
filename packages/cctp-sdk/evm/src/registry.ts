// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { registerPlatformAddress } from "@stable-io/cctp-sdk-definitions";
import { EvmAddress } from "./address.js";
import { BaseTx, Eip712Data } from "./platform.js";

declare module "@stable-io/cctp-sdk-definitions" {
  export interface PlatformRegistry {
    Evm: {
      Address: EvmAddress;
      UnsignedTx: BaseTx;
      //TODO is this good enough? do we need to also support bare strings?
      UnsignedMsg: Eip712Data;
    };
  }
}

registerPlatformAddress("Evm", EvmAddress);
