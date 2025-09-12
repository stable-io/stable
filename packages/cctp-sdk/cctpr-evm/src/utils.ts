// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { LoadedDomain, Usdc, usdcContracts } from "@stable-io/cctp-sdk-definitions";
import { EvmAddress, EvmClient, getTokenBalance } from "@stable-io/cctp-sdk-evm";

export async function getUsdcBalance(
  client: EvmClient,
  domain: LoadedDomain,
  owner: EvmAddress,
): Promise<Usdc> {
  const usdcAddr = new EvmAddress(usdcContracts.contractAddressOf[client.network][domain]);
  return getTokenBalance(client, usdcAddr, owner, Usdc);
}
