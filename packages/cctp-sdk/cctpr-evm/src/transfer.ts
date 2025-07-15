// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
import type { TODO } from "@stable-io/utils";
import type {
  GasTokenOf,
  LoadedDomain,
  Network,
  UniversalOrNative,
} from "@stable-io/cctp-sdk-definitions";
import {
  Usdc,
  platformClient,
  usdcContracts,
} from "@stable-io/cctp-sdk-definitions";
import type { CorridorParams, InOrOut, Quote, SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";
import { contractAddressOf } from "@stable-io/cctp-sdk-cctpr-definitions";
import type { ContractTx, Eip2612Data, EvmClient, Permit } from "@stable-io/cctp-sdk-evm";
import {
  EvmAddress,
  composeApproveTx,
  composePermitMsg,
  getTokenAllowance,
  getTokenBalance,
} from "@stable-io/cctp-sdk-evm";
import type { SupportedEvmDomain } from "./contractSdk/index.js";
import { CctpR, quoteIsInUsdc } from "./contractSdk/index.js";

// @todo: Subtype quote and remove runtime check
// export type Quote<N extends Network, S extends SupportedEvmDomain<N>> =
//   Exclude<ContractQuote<S>, { type: "offChain" }>;

export type TransferOptions = {
  usePermit?: boolean;
} | undefined;
export type TransferGeneratorT = ContractTx | Eip2612Data;
export type TransferGeneratorTReturn = ContractTx;

export async function* transfer<
  N extends Network,
  S extends SupportedEvmDomain<N>,
  D extends SupportedDomain<N>,
>(
  network: N,
  source: S,
  destination: D,
  sender: EvmAddress,
  recipient: UniversalOrNative<SupportedDomain<N> & LoadedDomain>,
  inOrOut: InOrOut,
  corridor: CorridorParams<N, S, D>,
  quote: Quote<S>,
  gasDropoff: GasTokenOf<D>,
  { usePermit = true }: TransferOptions = {},
): AsyncGenerator<TransferGeneratorT, TransferGeneratorTReturn> {
  if (quote.type === "offChain") {
    throw new Error("Off-chain quotes are not supported for Evm");
  }

  const usdcAddr = new EvmAddress(usdcContracts.contractAddressOf[network][source]);
  const cctprAddress = new EvmAddress(contractAddressOf(network, source as TODO));
  const client = platformClient(network, source) as TODO as EvmClient<N, S>;
  const cctprSdk = new CctpR(client);
  const [gasTokenBalance, usdcBalance, usdcAllowance] = await Promise.all([
    client.getBalance(sender),
    getTokenBalance(client, usdcAddr, sender, Usdc),
    getTokenAllowance(client, usdcAddr, sender, cctprAddress, Usdc),
  ]);

  const requiredAllowance = cctprSdk.checkCostAndCalcRequiredAllowance(
    inOrOut,
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
      ? composePermitMsg(network)(client, usdcAddr, sender, cctprAddress, requiredAllowance)
      : composeApproveTx(usdcAddr, sender, cctprAddress, requiredAllowance)
    );
  }

  const recipientUniversal = recipient.toUniversalAddress();

  return cctprSdk.transferWithRelay(
    destination,
    inOrOut,
    recipientUniversal,
    gasDropoff,
    corridor,
    quote,
    permit,
  );
};
