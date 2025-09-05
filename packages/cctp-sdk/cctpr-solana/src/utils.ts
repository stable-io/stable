// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { usdc, Usdc, usdcContracts } from "@stable-io/cctp-sdk-definitions";
import { findAta, getTokenBalance, SolanaAddress, SolanaClient } from "@stable-io/cctp-sdk-solana";

export async function getUsdcBalance(
  client: SolanaClient,
  owner: SolanaAddress,
): Promise<Usdc> {
  const userUsdc = findAta(
    owner,
    new SolanaAddress(usdcContracts.contractAddressOf[client.network]["Solana"]),
  );
  return getTokenBalance(client, userUsdc, Usdc).then(balance => balance ?? usdc(0));
}
