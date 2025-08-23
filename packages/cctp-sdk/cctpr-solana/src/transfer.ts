// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { TODO } from "@stable-io/utils";
import type { GasTokenOf, Network, Sol } from "@stable-io/cctp-sdk-definitions";
import {
  Usdc,
  usdc,
  platformClient,
  usdcContracts,
} from "@stable-io/cctp-sdk-definitions";
import type {
  CctprRecipientAddress,
  CorridorParamsBase,
  InOrOut,
  QuoteBase,
  SupportedDomain,
} from "@stable-io/cctp-sdk-cctpr-definitions";
import { quoteIsInUsdc, calcUsdcAmounts } from "@stable-io/cctp-sdk-cctpr-definitions";
import type { SolanaClient, TxMsg } from "@stable-io/cctp-sdk-solana";
import { SolanaAddress, findAta, getSolBalance, getTokenBalance } from "@stable-io/cctp-sdk-solana";
import { CctpR } from "./contractSdk/index.js";
import { ForeignDomain } from "./contractSdk/constants.js";

export type TransferOptions = Parameters<typeof CctpR.prototype.transferWithRelay>[7];
export type TransferGeneratorT = never;
export type TransferGeneratorTReturn = TxMsg;

//no yield because we don't need one
// eslint-disable-next-line require-yield
export async function* transfer<
  N extends Network,
  S extends "Solana",
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
  sender: SolanaAddress,
  recipient: CctprRecipientAddress<N, D>,
  inOrOut: InOrOut,
  corridor: CorridorParamsBase<N, "Solana", S, D>,
  quote: QuoteBase<N, "Solana", S>,
  gasDropoff: GasTokenOf<D>,
  opts?: TransferOptions,
): AsyncGenerator<never, TransferGeneratorTReturn> {
  const userUsdc = opts?.userUsdc ?? findAta(
    sender,
    new SolanaAddress(usdcContracts.contractAddressOf[network][source]),
  );
  const client = platformClient(network, source) as SolanaClient;
  const cctprSdk = new CctpR(network, client);
  const [solBalance, usdcBalance] = await Promise.all([
    getSolBalance(client, sender),
    getTokenBalance(client, userUsdc, Usdc),
  ]);

  const [requiredUsc] = calcUsdcAmounts(inOrOut, corridor, quote, usdc(0));

  if (usdcBalance.lt(requiredUsc))
    throw new Error("Insufficient USDC balance");

  if (!quoteIsInUsdc(quote) &&
      solBalance.lt((quote.type === "onChain" ? quote.maxRelayFee : quote.relayFee) as Sol))
    throw new Error("Insufficient gas token balance");

  const recipientUniversal = recipient.toUniversalAddress();

  return cctprSdk.transferWithRelay(
    destination as ForeignDomain<N>, //this is safe because D is distinct from S i.e. Solana
    inOrOut,
    recipientUniversal,
    gasDropoff,
    corridor,
    quote,
    sender,
    opts,
  );
}
