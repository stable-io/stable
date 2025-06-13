// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Url } from "@stable-io/utils";
import { Network } from "../types/index.js";
import { layouts, GaslessQuoteMessage } from "@stable-io/cctp-sdk-cctpr-evm";
import { fetchApiResponse, EvmDomains } from "@stable-io/cctp-sdk-definitions";

export const apiUrl = {
  Mainnet: "", // TODO
  Testnet: "http://localhost:3000", // won't be easy to work with the local quote api =(.
} as const satisfies Record<Network, string>;

export const apiEndpoint = <N extends Network>(network: N) => (
  path: string,
): Url => `${apiUrl[network]}/gasless/${path}` as Url;

export const apiEndpointWithQuery = <N extends Network>(network: N) => (
  path: string,
  query: Readonly<Record<string, string>>,
): Url => {
  const queryParams = new URLSearchParams(query).toString();
  const endpoint = apiEndpoint(network)(path);
  return `${endpoint}?${queryParams}` as Url;
};

export type OnchainGaslessQuote = GaslessQuoteMessage & { type: "onChain" };

export type GaslessTransferQuoteParams = {
  destination: keyof EvmDomains;
  inputAmount: string; // an stringified usdc value
  mintRecipient: string; // an stringified evm address
  gasDropoff: string; // a stringified bigint
  corridor: layouts.CorridorVariant;
  quote: OnchainGaslessQuote;
};

export type GetTransferQuoteResponse = {};
export function getTransferQuote(
  network: Network,
  transferParams: GaslessTransferQuoteParams,
  requiresAllowancePermit: boolean,
): Promise<GetTransferQuoteResponse> {
  const flat = {
    destination: transferParams.destination,
    inputAmount: transferParams.inputAmount,
    mintRecipient: transferParams.mintRecipient,
    gasDropoff: transferParams.gasDropoff,
    corridor: JSON.stringify(transferParams.corridor),
    quote: JSON.stringify(transferParams.quote),
  };

  const endpoint = apiEndpointWithQuery(network)("quote", flat);

  return fetchApiResponse(endpoint);
}

export type PostTransferRequestResponse = {};
export function postTransferRequest(): PostTransferRequestResponse {
  // const endpoint = apiEndpoint(network)
  // return fetchApiResponse()
  throw new Error("NotImplemented");
}
