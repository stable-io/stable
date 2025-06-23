// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Url, TODO } from "@stable-io/utils";
import { Network } from "../types/index.js";
import { layouts, GaslessQuoteMessage } from "@stable-io/cctp-sdk-cctpr-evm";
import { fetchApiResponse, EvmDomains, Usdc, GenericGasToken, usdc, genericGasToken } from "@stable-io/cctp-sdk-definitions";
import { EvmAddress, Permit2TypedData } from "@stable-io/cctp-sdk-evm";
import { deserializeBigints } from "@stable-io/utils";

export const apiUrl = {
  Mainnet: "", // TODO
  Testnet: "http://localhost:4000", // won't be easy to work with the local quote api =(.
} as const satisfies Record<Network, string>;

export const apiEndpoint = <N extends Network>(network: N) => (
  path: string,
): Url => `${apiUrl[network]}/gasless-transfer/${path}` as Url;

export const apiEndpointWithQuery = <N extends Network>(network: N) => (
  path: string,
  query: Readonly<Record<string, string>>,
): Url => {
  const queryParams = new URLSearchParams(query).toString();
  const endpoint = apiEndpoint(network)(path);
  return `${endpoint}?${queryParams}` as Url;
};

export type OnchainGaslessQuote = GaslessQuoteMessage & { type: "onChain" };

export type GetQuoteParams = {
  sourceChain: keyof EvmDomains,
  targetChain: keyof EvmDomains;
  amount: Usdc;
  sender: EvmAddress;
  recipient: EvmAddress;
  corridor: layouts.CorridorVariant["type"];
  gasDropoff: GenericGasToken;
  permit2PermitRequired: boolean;
};

export type GetQuoteResponse = {
  iat: number,
  exp: number,
  quoteRequest: GetQuoteParams,
  permit2TypedData: Permit2TypedData,

};
export async function getTransferQuote(
  network: Network,
  quoteParams: GetQuoteParams,
): Promise<GetQuoteResponse> {
  const apiParams: Record<string, string> = serializeQuoteRequest(quoteParams);

  const endpoint = apiEndpointWithQuery(network)("quote", apiParams);

  const apiResponse = await fetchApiResponse(endpoint);

  if (apiResponse.status >= 400) {
    throw new Error("Failed to get quote from API")
  }

  const jwt = extractJwtFromQuoteResponse(apiResponse.value);

  const payload = decodeAndDeserializeJwt(jwt);

  const quoteRequest = deserializeQuoteRequest(payload.quoteRequest as Record<string, unknown>);

  return {
    iat: payload.iat as number,
    exp: payload.exp as number,
    permit2TypedData: payload.permit2TypedData as Permit2TypedData,
    quoteRequest,
  };
}

function serializeQuoteRequest(quoteParams: GetQuoteParams): Record<string, string> {
  return {
    ...quoteParams,
    sourceDomain: quoteParams.sourceChain,
    targetDomain: quoteParams.targetChain,
    permit2PermitRequired: quoteParams.permit2PermitRequired.toString(),
    amount: quoteParams.amount.toUnit("human").toString(),
    sender: quoteParams.sender.toString(),
    recipient: quoteParams.recipient.toString(),
    gasDropoff: quoteParams.gasDropoff.toUnit("human").toString(),
  };
}

function deserializeQuoteRequest(responseQuoteParams: Record<string, unknown>): GetQuoteParams {
  return {
    sourceChain: responseQuoteParams.sourceDomain as keyof EvmDomains,
    targetChain: responseQuoteParams.targetDomain as keyof EvmDomains,
    permit2PermitRequired: responseQuoteParams.permit2PermitRequired as boolean,
    amount: usdc(responseQuoteParams.amount as string, "human"),
    sender: new EvmAddress(responseQuoteParams.sender as string),
    recipient: new EvmAddress(responseQuoteParams.recipient as string),
    gasDropoff: genericGasToken(responseQuoteParams.gasDropoff as string, "human"),
    corridor: responseQuoteParams.corridor as layouts.CorridorVariant["type"],
  }
}

const extractJwtFromQuoteResponse = (quoteResponse: unknown): string => {
  if (
    typeof quoteResponse !== "object" ||
    !quoteResponse ||
    !("data" in quoteResponse) ||
    typeof quoteResponse.data !== "object" ||
    !quoteResponse.data ||
    !("jwt" in quoteResponse.data) ||
    typeof quoteResponse.data.jwt !== "string"
  ) {
    throw new Error("Invalid quote response structure");
  }

  const { jwt } = quoteResponse.data;

  return jwt;
};

const decodeJwtPayload = (token: string): unknown => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    const payload = parts[1];
    if (!payload) {
      throw new Error("Missing JWT payload");
    }

    const paddedPayload = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decodedPayload = atob(paddedPayload);
    return JSON.parse(decodedPayload);
  } catch (error) {
    console.error("Failed to decode JWT:", error);
    throw error;
  }
};

const decodeAndDeserializeJwt = (jwt: string): Record<string, unknown> => {
  console.info("\n4️⃣ Decoding & deserializing JWT payload...");
  const jwtPayload = decodeJwtPayload(jwt);
  if (typeof jwtPayload !== "object" || !jwtPayload) {
    throw new Error("Invalid JWT payload structure");
  }

  // @todo: Type this properly
  const restoredPayload = deserializeBigints<any>(
    jwtPayload as Record<string, unknown>,
  );

  return restoredPayload;
};

export type PostTransferRequestResponse = {
  txHash: string;
};
export function postTransferRequest(): PostTransferRequestResponse {
  // const endpoint = apiEndpoint(network)
  // return fetchApiResponse()
  throw new Error("NotImplemented");
}
