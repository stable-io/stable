// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
import "@stable-io/cctp-sdk-evm";

//this is purely a workaround so that the selected network is defined when working on the sdk itself
declare module "@stable-io/cctp-sdk-definitions" {
  export interface ConfigRegistry {
    UseUnionAliases: true;
    SelectedNetwork: "Mainnet";
  }
}

declare module "./registry.js" {
  export interface PlatformImplsOf {
    Evm: never;
  }
}
