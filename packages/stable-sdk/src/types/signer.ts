// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Url } from "@stable-io/utils";
import type { WalletClient } from "viem";
import { Chain } from "viem/chains";

export interface EvmPlatformSigner extends BasePlatformSigner {
  platform: "Evm";
  getWalletClient(viemChain: Chain, url: Url): Promise<WalletClient>;
}

export type SupportedPlatform = "Evm" | "Solana";

export interface BasePlatformSigner {
  platform: SupportedPlatform;
}

export type PlatformSigner = EvmPlatformSigner;
