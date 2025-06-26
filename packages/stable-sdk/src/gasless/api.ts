// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Url, BaseObject, encoding } from "@stable-io/utils";
import { Network } from "../types/index.js";
import { layouts } from "@stable-io/cctp-sdk-cctpr-evm";
import { EvmDomains, Usdc, GenericGasToken, usdc, genericGasToken } from "@stable-io/cctp-sdk-definitions";
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

export type HTTPCode = 200 | 201 | 202 | 204 | 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500;
export type APIResponse<S extends HTTPCode, V> = Readonly<{
  status: S;
  value: V;
}>;

export interface ApiRequestOptions {
  method?: "GET" | "POST";
  body?: BaseObject;
  headers?: Record<string, string>;
}

const defaultHeaders = { "Content-Type": "application/json" };

export async function apiRequest<T extends APIResponse<HTTPCode, BaseObject>>(
  endpoint: Url,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;
  
  const requestOptions: RequestInit = {
    method,
    headers: { ...defaultHeaders, ...headers },
  };

  if (body && method === "POST") {
    requestOptions.body = JSON.stringify(body);
  }

  const response = await fetch(endpoint, requestOptions);
  const status = response.status as HTTPCode;
  const value = await response.json();
  
  return { status, value } as T;
}

export type GetQuoteParams = {
  sourceChain: keyof EvmDomains,
  targetChain: keyof EvmDomains;
  amount: Usdc;
  sender: EvmAddress;
  recipient: EvmAddress;
  corridor: layouts.CorridorVariant["type"];
  gasDropoff: GenericGasToken;
  permit2PermitRequired: boolean;
  maxRelayFee: Usdc;
  maxFastFee: Usdc;
  takeFeesFromInput: boolean;
};

export type GetQuoteResponse = {
  iat: number;
  exp: number;
  quoteRequest: GetQuoteParams;
  permit2TypedData: Permit2TypedData;
  gaslessFee: Usdc;
  jwt: string;
};

export async function getTransferQuote(
  network: Network,
  quoteParams: GetQuoteParams,
): Promise<GetQuoteResponse> {
  const apiParams: Record<string, string> = serializeQuoteRequest(quoteParams);

  const endpoint = apiEndpointWithQuery(network)("quote", apiParams);

  const apiResponse = await apiRequest(endpoint, { method: "GET" });

  if (apiResponse.status >= 400) {
    throw new Error(`Failed to get quote from API. Status Code: ${apiResponse.status}`);
  }

  const jwt = extractJwtFromQuoteResponse(apiResponse.value);

  const payload = decodeAndDeserializeJwt(jwt);

  const quoteRequest = deserializeQuoteRequest(payload.quoteRequest as Record<string, unknown>);
  const gaslessFee = usdc(payload.gaslessFee! as string);
  return {
    iat: payload.iat as number,
    exp: payload.exp as number,
    permit2TypedData: payload.permit2TypedData as Permit2TypedData,
    quoteRequest,
    gaslessFee,
    jwt,
  };
}

function serializeQuoteRequest(params: GetQuoteParams): Record<string, string> {
  return {
    ...params,
    sourceDomain: params.sourceChain,
    targetDomain: params.targetChain,
    permit2PermitRequired: params.permit2PermitRequired.toString(),
    amount: params.amount.toUnit("human").toString(),
    sender: params.sender.toString(),
    recipient: params.recipient.toString(),
    gasDropoff: params.gasDropoff.toUnit("human").toString(),
    takeFeesFromInput: params.takeFeesFromInput.toString(),
    maxRelayFee: params.maxRelayFee.toUnit("human").toFixed(6).toString(),
    maxFastFee: params.corridor === "v2Direct"
      ? params.maxRelayFee.toUnit("human").toFixed(6).toString()
      : "0"
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
    takeFeesFromInput: responseQuoteParams.takeFeesFromInput as boolean,
    maxRelayFee: usdc(responseQuoteParams.maxRelayFee as string),
    maxFastFee: usdc(responseQuoteParams.maxFastFee as string ?? 0),
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
    throw error;
  }
};

const decodeAndDeserializeJwt = (jwt: string): Record<string, unknown> => {
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

export type PostTransferParams = {
  jwt: string;
  permit2Signature: Uint8Array;
  permitSignature?: Uint8Array;
};

export type PostTransferResponse = {
  txHash: string;
};

export async function postTransferRequest(network: Network, params: PostTransferParams): Promise<PostTransferResponse> {
  const endpoint = apiEndpoint(network)("relay");
  
  const requestBody = {
    jwt: params.jwt,
    permit2Signature: encoding.hex.encode(params.permit2Signature, true),
    permitSignature: params.permitSignature ? encoding.hex.encode(params.permitSignature, true) : undefined,
  };

  const apiResponse = await apiRequest<APIResponse<HTTPCode, { txHash: string }>>(
    endpoint,
    { method: "POST", body: requestBody }
  );

  if (apiResponse.status >= 400) {
    throw new Error(`Gasless Transfer Request Failed. Status Code: ${apiResponse.status}.`);
  }

  return { txHash: apiResponse.value.txHash };
}
