// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { TODO } from "@stable-io/utils";
import type {
  GasTokenOf,
  LoadedDomain,
  Network,
  UniversalOrNative,
} from "@stable-io/cctp-sdk-definitions";
import {
  gasTokenKindOf,
  init as initDefinitions,
  Usdc,
} from "@stable-io/cctp-sdk-definitions";
import { init as initCctpr } from "@stable-io/cctp-sdk-cctpr-definitions";
import type { ContractTx, Eip2612Data, EvmClient, Permit } from "@stable-io/cctp-sdk-evm";
import { EvmAddress, init as initEvm } from "@stable-io/cctp-sdk-evm";
import type { SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";
import { Amount } from "@stable-io/amount";
import { CctpR, quoteIsInUsdc } from "./contractSdk/index.js";
import type {
  Quote as ContractQuote,
  CorridorParams,
  SupportedEvmDomain,
} from "./contractSdk/index.js";

export type Quote<N extends Network, S extends SupportedEvmDomain<N>> =
  Exclude<ContractQuote<S>, { type: "offChain" }>;

export const transfer = <N extends Network>(network: N) => {
  const cctpr = initCctpr(network);
  const { usdcContracts } = initDefinitions(network);
  const {
    getTokenBalance,
    getTokenAllowance,
    composeApproveTx,
    composePermitMsg,
  } = initEvm(network);

  return async function* <
    S extends SupportedEvmDomain<N>,
    //can't exclude S from D because S might be a union of domains
    D extends SupportedDomain<N>,
  >(
    client: EvmClient<N, S>,
    sender: EvmAddress,
    destinationDomain: D,
    recipient: UniversalOrNative<SupportedDomain<N> & LoadedDomain>,
    IoAmountUsdc: Usdc, //TODO: this should use InOrOut too
    quote: Quote<N, S>,
    gasDropoff: GasTokenOf<D>,
    corridor: CorridorParams<N, S, D>,
    takeFeesFromInput: boolean, //TODO: this should use InOrOut too
    usePermit: boolean = true,
  ): AsyncGenerator<ContractTx | Eip2612Data, ContractTx> {
    const sourceDomain = client.domain;

    const gasDropoffLimit = Amount.ofKind(gasTokenKindOf(destinationDomain))(
      cctpr.gasDropoffLimitOf[destinationDomain],
    );

    if (gasDropoff.gt(gasDropoffLimit as TODO))
      throw new Error("Gas Drop Off Limit Exceeded");

    const usdcAddr = new EvmAddress(usdcContracts.contractAddressOf[sourceDomain]);
    const cctprAddress = new EvmAddress((cctpr.contractAddressOf as TODO)(sourceDomain));
    const cctprSdk = new CctpR(client);
    const [gasTokenBalance, usdcBalance, usdcAllowance] = await Promise.all([
      client.getBalance(sender),
      getTokenBalance(client, usdcAddr, sender, Usdc),
      getTokenAllowance(client, usdcAddr, sender, cctprAddress, Usdc),
    ]);

    const requiredAllowance = cctprSdk.checkCostAndCalcRequiredAllowance(
      { amount: IoAmountUsdc, type: takeFeesFromInput ? "in" : "out" },
      quote,
      corridor,
    );

    if (usdcBalance.lt(requiredAllowance))
      throw new Error("Insufficient USDC balance");

    if (!quoteIsInUsdc(quote) && gasTokenBalance.lt(quote.maxRelayFee as TODO))
      throw new Error("Insufficient gas token balance");

    let permit: Permit | undefined;
    if (usdcAllowance.lt(requiredAllowance)) {
      permit = yield (
        usePermit
        ? composePermitMsg(client, usdcAddr, sender, cctprAddress, requiredAllowance)
        : composeApproveTx(usdcAddr, sender, cctprAddress, requiredAllowance)
      );
    }

    const recipientUniversal = recipient.toUniversalAddress();

    return cctprSdk.transferWithRelay(
      destinationDomain,
      { amount: IoAmountUsdc, type: takeFeesFromInput ? "in" : "out" },
      recipientUniversal,
      gasDropoff,
      corridor,
      quote,
      permit,
    );
  };
};
