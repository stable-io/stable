// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Url } from "@stable-io/utils";
import type { Account, WalletClient } from "viem";
import { createWalletClient, http } from "viem";
import type { Chain } from "viem/chains";
import type { EvmPlatformSigner } from "../types/signer.js";

export class ViemSigner implements EvmPlatformSigner {
  public readonly platform = "Evm" as const;

  constructor(private account: Account) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  public async getWalletClient(
    viemChain: Chain,
    url: Url,
  ): Promise<WalletClient> {
    return createWalletClient({
      account: this.account,
      chain: viemChain,
      transport: http(url),
    });
  }
}
