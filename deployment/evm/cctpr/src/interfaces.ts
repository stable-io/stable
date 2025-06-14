// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { WormholeChainId } from "@stable-io/cctp-sdk-definitions";

export interface ChainConfig {
  chainId: WormholeChainId;
}

export interface VerificationApiKeys extends ChainConfig {
  etherscan: string;
  blockscout?: {
    mainnet: string;
    testnet: string;
  };
  sourcify?: string;
}

export type UncheckedConstructorArgs = readonly any[];
