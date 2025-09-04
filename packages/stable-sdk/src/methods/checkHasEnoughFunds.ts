// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Network } from "@stable-io/cctp-sdk-definitions";
import { gasTokenOf, isUsdc, platformClient, sol, Usdc, usdcContracts } from "@stable-io/cctp-sdk-definitions";
import { EvmAddress, EvmAddressish, getTokenBalance as getTokenBalanceEvm } from "@stable-io/cctp-sdk-evm";
import { TODO } from "@stable-io/utils";
import { SDK } from "../types/index.js";
import { SupportedRoute } from "../types/route.js";
import { SolanaAddress, SolanaAddressish, getSolBalance } from  "@stable-io/cctp-sdk-solana";
import { getUsdcBalance } from "@stable-io/cctp-sdk-cctpr-solana";

export type CheckHasEnoughFundsDeps<N extends Network> = Pick<SDK<N>, "getNetwork" | "getRpcUrl">;

export const $checkHasEnoughFunds =
  <N extends "Mainnet" | "Testnet">(
    { getNetwork, getRpcUrl }: CheckHasEnoughFundsDeps<N>,
  ): SDK<N>["checkHasEnoughFunds"] =>
  async (route: SupportedRoute<N>) => {
    const { intent: { sourceChain, sender, amount }, fees } = route;
    const network = getNetwork();
    const rpcUrl = getRpcUrl(sourceChain);

    const client = platformClient(
      network,
      sourceChain,
      rpcUrl,
    );

    const gasToken = gasTokenOf(sourceChain);

    const requiredGasFromSteps = route.steps.reduce(
      (acc, step) => acc.add(gasToken(step.gasCostEstimation, "atomic") as TODO),
      gasToken(0),
    );
    const requiredBalance = fees.reduce(
      (acc, fee) => isUsdc(fee)
        ? acc // usdc fees are discounted from the amount sent.
        : { ...acc, gasToken: acc.gasToken.add(fee as TODO) },
      { gasToken: requiredGasFromSteps, usdc: amount },
    );

    const usdcAddr = new EvmAddress(usdcContracts.contractAddressOf[network][sourceChain]);
    const [gasTokenBalance, usdcBalance] = client.platform === "Solana" ? await Promise.all([
      getSolBalance(client, new SolanaAddress(sender as SolanaAddressish)).then(
        balance => balance ?? sol(0)
      ),
      getUsdcBalance(client, new SolanaAddress(sender as SolanaAddressish)),
    ]) : await Promise.all([
      client.getBalance(new EvmAddress(sender as EvmAddressish)),
      getTokenBalanceEvm(client, usdcAddr, new EvmAddress(sender as EvmAddressish), Usdc),
    ]);

    const hasEnoughUsdc = usdcBalance.ge(requiredBalance.usdc);
    const hasEnoughGas = gasTokenBalance.ge(requiredBalance.gasToken as TODO);
    return hasEnoughUsdc && hasEnoughGas;
};
