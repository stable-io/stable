// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Network, SDK } from "../types/index.js";
import { EvmAddress, getTokenBalance as getTokenBalanceEvm } from "@stable-io/cctp-sdk-evm";
import { init as initDefinitions, platformClient, Usdc } from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress } from "@stable-io/cctp-sdk-solana";
import { getUsdcBalance } from "@stable-io/cctp-sdk-cctpr-solana";

export type getBalanceDeps<N extends Network> = Pick<SDK<N>, "getNetwork" | "getRpcUrl">;

export const $getBalance =
  <N extends Network>({
    getNetwork,
    getRpcUrl,
  }: getBalanceDeps<N>): SDK<N>["getBalance"] =>
  async (address, domains): ReturnType<SDK<N>["getBalance"]> => {
    const network = getNetwork();
    const definitions = initDefinitions(network);
    const balances = await Promise.all(domains.map(async (domain) => {
      const rpcUrl = getRpcUrl(domain);
      const client = platformClient(
        network,
        domain,
        rpcUrl,
      );
      let balance: Usdc;

      if (client.platform === "Solana") {
        balance = await getUsdcBalance(client, new SolanaAddress(address));
      }
      else {
        const contract = definitions.usdcContracts.contractAddressOf[domain];
        balance = await getTokenBalanceEvm(
          client, new EvmAddress(contract), new EvmAddress(address), Usdc,
        );
      }

      return [domain, balance.toUnit("human").toString()];
    }));
    return Object.fromEntries(balances);
  };
