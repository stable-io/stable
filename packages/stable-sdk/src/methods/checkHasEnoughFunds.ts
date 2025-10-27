// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { LoadedDomain, Network } from "@stable-io/cctp-sdk-definitions";
import { gasTokenKindOf, gasTokenOf, isUsdc, platformClient, sol } from "@stable-io/cctp-sdk-definitions";
import { EvmAddress, EvmAddressish } from "@stable-io/cctp-sdk-evm";
import { TODO } from "@stable-io/utils";
import { SDK } from "../types/index.js";
import { SupportedRoute } from "../types/route.js";
import { SolanaAddress, SolanaAddressish, getSolBalance } from  "@stable-io/cctp-sdk-solana";
import { getUsdcBalance as getUsdcBalanceSolana } from "@stable-io/cctp-sdk-cctpr-solana";
import { getUsdcBalance as getUsdcBalanceEvm } from "@stable-io/cctp-sdk-cctpr-evm";
import { EvmCostEstimation, SOLANA_TRANSFER, SolanaCostEstimation } from "./findRoutes/steps.js";
import { EvmDomainPrices, getDomainPrices, SolanaDomainPrices } from "src/api/oracle.js";
import { getGasTokenCost, getTotalEvmGasTokenCost, getTotalSolCost } from "./findRoutes/fees.js";
import { LoadedCctprDomain } from "@stable-io/cctp-sdk-cctpr-definitions";

export type CheckHasEnoughFundsDeps<N extends Network> = Pick<SDK<N>, "getNetwork" | "getRpcUrl">;

export const $checkHasEnoughFunds =
  <N extends "Mainnet" | "Testnet">(
    { getNetwork, getRpcUrl }: CheckHasEnoughFundsDeps<N>,
  ): SDK<N>["checkHasEnoughFunds"] =>
  async <S extends LoadedCctprDomain<N>>(route: SupportedRoute<N, S>) => {
    const { intent: { sourceChain, sender, amount }, fees } = route;
    const network = getNetwork();
    const rpcUrl = getRpcUrl(sourceChain);
    const client = platformClient(
      network,
      sourceChain,
      rpcUrl,
    );
    const domainPrices = await getDomainPrices(
      network,
      { domain: sourceChain as LoadedDomain },
    );
    const totalGasCost = route.steps.reduce((acc, { costEstimation }) =>
      acc + getGasTokenCost(sourceChain, costEstimation.sourceChain, domainPrices).toUnit("atomic")
    , 0n);
    const totalGasCostInGasToken = gasTokenOf(sourceChain)(totalGasCost, "atomic");
    const requiredBalance = fees.reduce(
      (acc, fee) => isUsdc(fee)
        ? acc // usdc fees are discounted from the amount sent.
        : { ...acc, gasToken: acc.gasToken.add(fee as TODO) },
        { gasToken: totalGasCostInGasToken as TODO, usdc: amount },
    );

    const [gasTokenBalance, usdcBalance] = client.platform === "Solana"
      ? await Promise.all([
          getSolBalance(client, new SolanaAddress(sender as SolanaAddressish)).then(
            balance => balance ?? sol(0),
          ),
          getUsdcBalanceSolana(client, new SolanaAddress(sender as SolanaAddressish)),
        ])
      : await Promise.all([
          client.getBalance(new EvmAddress(sender as EvmAddressish)),
          getUsdcBalanceEvm(client, sourceChain, new EvmAddress(sender as EvmAddressish)),
        ]);

    const availableBalance = { gasToken: gasTokenBalance as TODO, usdc: usdcBalance };
    const hasEnoughUsdc = usdcBalance.ge(requiredBalance.usdc);
    const hasEnoughGas = gasTokenBalance.ge(requiredBalance.gasToken as TODO);
    return {
      hasEnoughBalance: hasEnoughUsdc && hasEnoughGas,
      requiredBalance,
      availableBalance,
    };
};
