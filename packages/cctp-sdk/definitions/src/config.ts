// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

//this is purely a workaround so that the selected network is defined when working on the sdk itself
declare module "./registry.js" {
  export interface ConfigRegistry {
    UseUnionAliases: true;
    SelectedNetwork: "Mainnet";
  }

  export interface PlatformRegistry {
    Evm: any;
    Solana: any;
  }
}
