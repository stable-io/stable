// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";
import { init as initCctpr } from "@stable-io/cctp-sdk-cctpr-definitions";
import type {
  GasTokenOf,
  LoadedDomain,
  Network,
  UniversalOrNative,
  v2,
} from "@stable-io/cctp-sdk-definitions";
import {
  gasTokenKindOf,
  init as initDefinitions,
  usdc,
  Usdc,
} from "@stable-io/cctp-sdk-definitions";
import type { ContractTx, Eip2612Data, EvmClient, Permit } from "@stable-io/cctp-sdk-evm";
import { EvmAddress, init as initEvm } from "@stable-io/cctp-sdk-evm";
import type { TODO } from "@stable-io/utils";
import { Amount } from "@stable-io/amount";
import type { Quote as ContractQuote } from "./contractSdk/index.js";
import { CctpR, layouts, quoteIsInUsdc } from "./contractSdk/index.js";
import { SupportedEvmDomain } from "./common.js";

type CorridorVariant = layouts.CorridorVariant;

export type Quote<N extends Network, S extends SupportedEvmDomain<N>> =
  Exclude<ContractQuote<S>, { type: "offChain" }>;

type CorridorParam<
  N extends Network,
  S extends SupportedEvmDomain<N>,
  D extends SupportedDomain<N>,
> =
  S extends "Avalanche"
  //corridor variant is always v1 because Avalanche is fast by default
  ? { readonly corridor?: { readonly type: "v1" } }
  : S extends v2.SupportedDomain<N>
  ? { readonly corridor:
      D extends v2.SupportedDomain<N>
      ? Exclude<CorridorVariant, { readonly type: "avaxHop" }>
      : Exclude<CorridorVariant, { readonly type: "v2Direct" }>;
    }
  : { readonly corridor?: { readonly type: "v1" } }; //only v1 available

type OptionalParams<
  N extends Network,
  S extends SupportedEvmDomain<N>,
  D extends SupportedDomain<N>,
> = { readonly usePermit?: boolean } & CorridorParam<N, S, D>;

export const transfer = <N extends Network>(network: N) => {
  const cctpr = initCctpr(network);
  const { usdcContracts, v2 } = initDefinitions(network);
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
    inputAmountUsdc: Usdc,
    quote: Quote<N, S>,
    gasDropoff: GasTokenOf<D>,
    opts?: OptionalParams<N, S, D>,
  ): AsyncGenerator<ContractTx | Eip2612Data, ContractTx> { //TODO fix yield type
    const sourceDomain = client.domain;
    //TODO turn into utility function and move to definitions/utils or something
    if ((sourceDomain as string) === (destinationDomain as string))
      throw new Error("Source and destination domains cannot be the same");

    const corridor = opts?.corridor ?? { type: "v1" } as const;
    if (corridor.type === "avaxHop") {
      if (([sourceDomain, destinationDomain] as string[]).includes("Avalanche"))
        throw new Error("Can't use avaxHop corridor with Avalanche being source or destination");

      if (!v2.isSupportedDomain(sourceDomain))
        throw new Error("Can't use avaxHop corridor with non-v2 source domain");

      if (v2.isSupportedDomain(destinationDomain))
        throw new Error("Don't use avaxHop corridor when destination is also a v2 domain");
    }

    if (corridor.type === "v2Direct") {
      if (sourceDomain === "Avalanche")
        throw new Error("No point in using v2 corridor when source is Avalanche");

      if (
        !v2.isSupportedDomain(sourceDomain) ||
        !v2.isSupportedDomain(destinationDomain)
      )
        throw new Error("Can't use v2 corridor for non-v2 domains");
    }

    const gasDropoffLimit = Amount.ofKind(gasTokenKindOf(destinationDomain))(
      cctpr.gasDropoffLimitOf[destinationDomain],
    );

    if (gasDropoff.gt(gasDropoffLimit as TODO))
      throw new Error("Gas Drop Off Limit Exceeded");

    const usdcAddr = new EvmAddress(usdcContracts.contractAddressOf[sourceDomain]);
    const cctprAddress = new EvmAddress((cctpr.contractAddressOf as TODO)(sourceDomain));

    const cctprSdk = new CctpR(client, cctprAddress);
    const [gasTokenBalance, usdcBalance, usdcAllowance] = await Promise.all([
      client.getBalance(sender),
      getTokenBalance(client, usdcAddr, sender, Usdc),
      getTokenAllowance(client, usdcAddr, sender, cctprAddress, Usdc),
    ]);

    const requiredAllowance = inputAmountUsdc.add(
      quoteIsInUsdc(quote) && !quote.takeFeesFromInput ? quote.maxRelayFee : usdc(0),
    );

    if (usdcBalance.lt(requiredAllowance))
      throw new Error("Insufficient USDC balance");

    if (!quoteIsInUsdc(quote) && gasTokenBalance.lt(quote.maxRelayFee as TODO))
      throw new Error("Insufficient gas token balance");

    if (inputAmountUsdc.le(
      (quoteIsInUsdc(quote) && quote.takeFeesFromInput ? quote.maxRelayFee : usdc(0))
        .add(corridor.type === "v1" ? usdc(0) : corridor.maxFastFeeUsdc),
    ))
      throw new Error("Costs exceed input amount");

    let permit: Permit | undefined;
    if (usdcAllowance.lt(requiredAllowance)) {
      permit = yield (opts?.usePermit
        ? composePermitMsg(client, usdcAddr, sender, cctprAddress, requiredAllowance)
        : composeApproveTx(usdcAddr, sender, cctprAddress, requiredAllowance)
      );
    }

    const recipientUniversal = recipient.toUniversalAddress();

    // If the fee is paid in usdc. And is not taken from input, then we need to add
    // the fee to the input amount
    return cctprSdk.transferWithRelay(
      destinationDomain,
      inputAmountUsdc,
      recipientUniversal,
      gasDropoff,
      corridor,
      quote,
      permit,
    );
  };
};
