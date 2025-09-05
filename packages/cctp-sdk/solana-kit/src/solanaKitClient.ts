// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { type Base64EncodedDataResponse, type Lamports, type Address, createSolanaRpc } from "@solana/kit";
import { Network, Sol, sol } from "@stable-io/cctp-sdk-definitions";
import { getSolBalance, SolanaAddress, type AccountInfo, type SolanaClient } from "@stable-io/cctp-sdk-solana";
import { RoArray } from "@stable-io/map-utils";
import { encoding, Url } from "@stable-io/utils";

type SolanaRpcClient = ReturnType<typeof createSolanaRpc>;

export type RpcAccountInfo = (Readonly<{
  executable: boolean;
  lamports: Lamports;
  owner: Address;
  rentEpoch: bigint;
  space: bigint;
  data: Base64EncodedDataResponse;
}>) | null

function toAccountInfo(accInfo: RpcAccountInfo): AccountInfo | undefined {
  return accInfo ? { 
    executable: accInfo.executable,
    owner:      new SolanaAddress(accInfo.owner),
    lamports:   sol(accInfo.lamports, "lamports"),
    data:       encoding.base64.decode(accInfo.data[0]),
  } : undefined;
}

export class SolanaKitClient<N extends Network = Network> implements SolanaClient<N> {
  readonly network: N;
  readonly platform = "Solana";
  readonly domain = "Solana";
  readonly client: SolanaRpcClient;

  private static readonly defaultRpcs: Record<Network, Url> = {
    Mainnet: "https://api.mainnet-beta.solana.com" as Url,
    Testnet: "https://api.devnet.solana.com" as Url,
  };

  static fromNetworkAndDomain<N extends Network>(
    network: N,
    _domain: "Solana",
    rpcUrl?: Url,
  ): SolanaKitClient<N> {
    const client = createSolanaRpc(rpcUrl ?? SolanaKitClient.defaultRpcs[network]);
    return new SolanaKitClient(network, client);
  }

  constructor(network: N, client: SolanaRpcClient) {
    this.network = network;
    this.client = client;
  }

  async getAccountInfo(address: SolanaAddress): Promise<AccountInfo | undefined> {
    return toAccountInfo(
      (await this.client.getAccountInfo(address.unwrap(), { encoding: "base64" }).send()).value
    );
  }

  async getMultipleAccounts(
    addresses: RoArray<SolanaAddress>
  ): Promise<(AccountInfo | undefined)[]> {
    return (
      await this.client.getMultipleAccounts(
        addresses.map(addr => addr.unwrap()),
        { encoding: "base64" }
      ).send()
    ).value.map(toAccountInfo);
  }

  getBalance(
    owner: SolanaAddress,
  ): Promise<Sol> {
    return getSolBalance(this, owner).then(balance => balance ?? sol(0));
  }
}
