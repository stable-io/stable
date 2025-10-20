// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { usdc, Usdc, usdcContracts, Network } from "@stable-io/cctp-sdk-definitions";
import { 
  findAta,
  getTokenBalance,
  SolanaAddress,
  SolanaClient,
  systemProgramId
} from "@stable-io/cctp-sdk-solana";

export function findUsdcAta(
  network: Network,
  address: SolanaAddress
): SolanaAddress {
  return findAta(address, new SolanaAddress(usdcContracts.contractAddressOf[network]["Solana"]));
}

export async function getUsdcBalance(
  client: SolanaClient,
  owner: SolanaAddress,
): Promise<Usdc> {
  const userUsdc = findUsdcAta(client.network, owner);
  return getTokenBalance(client, userUsdc, Usdc).then(balance => balance ?? usdc(0));
}

export async function getUsdcAtaFromUser(
  client: SolanaClient,
  userAddress: string | SolanaAddress
): Promise<SolanaAddress> {
    const solanaAddress = new SolanaAddress(userAddress);
    const accountInfo = await client.getAccountInfo(solanaAddress);
    if (!accountInfo)
        throw new Error("Failed to get account info")
    if (!accountInfo.owner.equals(systemProgramId))
      throw new Error("Tried to get an ATA of a non system owned account")
    return findUsdcAta(client.network, solanaAddress);
}