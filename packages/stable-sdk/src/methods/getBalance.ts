// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Network, SDK } from "../types/index.js";
import { EvmAddress, getTokenBalance as getTokenBalanceEvm } from "@stable-io/cctp-sdk-evm";
import { init as initDefinitions, platformClient, Usdc } from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress, getTokenBalance as getTokenBalanceSolana } from "@stable-io/cctp-sdk-solana";
import { Amount, KindWithAtomic } from "@stable-io/amount";

export type getBalanceDeps<N extends Network> = Pick<SDK<N>, "getNetwork" | "getRpcUrl">;

export const $getBalance =
  <
    N extends Network,
    K extends KindWithAtomic,
  >({
    getNetwork,
    getRpcUrl,
  }: getBalanceDeps<N>): SDK<N>["getBalance"] =>
  async <K extends KindWithAtomic>(address, domains): ReturnType<SDK<N>["getBalance"]> => {
    const network = getNetwork();
    const definitions = initDefinitions(network);
    const balances = await Promise.all(domains.map(async (domain) => {
      const wrappedAddress = domain === "Solana" ? new SolanaAddress(address) : new EvmAddress(address);
      const rpcUrl = getRpcUrl(domain);
      const client = platformClient(
        network,
        domain,
        rpcUrl,
      );
      let balance;
      let contract = definitions.usdcContracts.contractAddressOf[domain];

      if (domain === "Solana") {
        contract = new SolanaAddress(contract);
        const rawBalance = await getTokenBalanceSolana(client, contract, wrappedAddress);
        balance = Array.isArray(rawBalance) ?
          rawBalance.reduce((
            total: Amount<K>, tokenAmount: Amount<K>) => tokenAmount.add(total), Amount.from("0", KindWithAtomic)) as Amount<KindWithAtomic>
          : rawBalance;
      }
      else {
        contract = new EvmAddress(contract);
        balance = await getTokenBalanceEvm(client, contract, wrappedAddress as EvmAddress, Usdc);
      }

      return [domain, balance.toUnit("human").toString()];
    }));
    return Object.fromEntries(balances);
  };
