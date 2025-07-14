// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type {} from "@stable-io/cctp-sdk-cctpr-definitions";

declare module "@stable-io/cctp-sdk-cctpr-definitions" {
  export interface PlatformImplsOf {
    Solana: never;
  }
}
