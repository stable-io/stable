// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { EvmDomains, Network } from "@stable-io/cctp-sdk-definitions";
import { gasTokenOf, isUsdc, platformClient, Usdc, usdc, usdcContracts } from "@stable-io/cctp-sdk-definitions";
import { EvmAddress, EvmAddressish, getTokenBalance as getTokenBalanceEvm } from "@stable-io/cctp-sdk-evm";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { TODO, Url } from "@stable-io/utils";
import { SDK } from "../types/index.js";
import { SupportedRoute } from "../types/route.js";
import { SolanaAddress, SolanaAddressish, getTokenBalance as getTokenBalanceSolana } from  "@stable-io/cctp-sdk-solana";

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
    let senderAddr: SolanaAddress | EvmAddress;
    let usdcAddr: SolanaAddress | EvmAddress;

    if (sourceChain === "Solana") {
      senderAddr = new SolanaAddress(sender as SolanaAddressish);
      usdcAddr = new SolanaAddress(usdcContracts.contractAddressOf[network][sourceChain]);
    }
    else {
      senderAddr = new EvmAddress(sender as EvmAddressish);
      usdcAddr = new EvmAddress(usdcContracts.contractAddressOf[network][sourceChain]);
    }

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

    const [gasTokenBalance, usdcBalance] = await Promise.all([
      client.getBalance(senderAddr),
      sourceChain === "Solana"
        ? getTokenBalanceSolana(client, usdcAddr, senderAddr)
        : getTokenBalanceEvm(client, usdcAddr as EvmAddress, senderAddr as EvmAddress, Usdc),
    ]);

    const hasEnoughUsdc = usdcBalance.ge(requiredBalance.usdc);
    const hasEnoughGas = gasTokenBalance.ge(requiredBalance.gasToken as TODO);
    return hasEnoughUsdc && hasEnoughGas;
};
