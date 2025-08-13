// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { encoding, deserializeBigints } from "@stable-io/utils";
import { layouts } from "@stable-io/cctp-sdk-cctpr-evm";
import { EvmDomains, Usdc, GenericGasToken, usdc, genericGasToken, Percentage, percentage } from "@stable-io/cctp-sdk-definitions";
import { EvmAddress, Permit, Permit2TypedData } from "@stable-io/cctp-sdk-evm";

import { Network } from "../types/index.js";
import { apiEndpointWithQuery, apiRequest, apiEndpoint, HTTPCode, APIResponse } from "./base.js";

export type GetQuoteParams = {
  sourceChain: keyof EvmDomains;
  targetChain: keyof EvmDomains;
  amount: Usdc;
  sender: EvmAddress;
  recipient: EvmAddress;
  corridor: layouts.CorridorVariant["type"];
  gasDropoff: GenericGasToken;
  permit2PermitRequired: boolean;
  maxRelayFee: Usdc;
  fastFeeRate: Percentage;
  takeFeesFromInput: boolean;
};

export type GetQuoteResponse = {
  iat: number;
  exp: number;
  quoteRequest: GetQuoteParams;
  permit2TypedData: Permit2TypedData;
  gaslessFee: Usdc;
  jwt: string;
} | undefined;

export async function getTransferQuote(
  network: Network,
  quoteParams: GetQuoteParams,
): Promise<GetQuoteResponse> {
  const apiParams: Record<string, string> = serializeQuoteRequest(quoteParams);

  const endpoint = apiEndpointWithQuery(network)("gasless-transfer/quote", apiParams);

  const apiResponse = await apiRequest(endpoint, { method: "GET" });

  if (apiResponse.status >= 400) {
    console.error(`GET Quote failed with status ${apiResponse.status}`);
    return undefined;
  }

  const jwt = extractJwtFromQuoteResponse(apiResponse.value);

  const payload = decodeAndDeserializeJwt(jwt);

  if (payload.willRelay === false) {
    return undefined;
  }

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
    fastFeeRate: params.corridor === "v2Direct"
      ? params.fastFeeRate.toUnit("human").toString()
      : "0",
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
    fastFeeRate: percentage(responseQuoteParams.fastFeeRate as string || "0"),
  };
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

export type PostTransferResponse = {
  txHash: `0x${string}`;
};

export type PostTransferParams = {
  jwt: string;
  permit2Signature: Uint8Array;
  permit?: Permit;
};

export async function postTransferRequest(
  network: Network,
  params: PostTransferParams,
): Promise<PostTransferResponse> {
  const endpoint = apiEndpoint(network)("gasless-transfer/relay");
  const { jwt, permit2Signature, permit } = params;
  const requestBody = {
    jwt: jwt,
    permit2Signature: encoding.hex.encode(permit2Signature, true),
    ...(permit
? { permit: {
      signature: encoding.hex.encode(permit.signature, true),
      value: permit.value.toString(),
      deadline: permit.deadline.toString(),
    } }
: {}),
  };

  const apiResponse = await apiRequest<APIResponse<HTTPCode, { data: { hash: string } } >>(
    endpoint,
    { method: "POST", body: requestBody },
  );

  if (apiResponse.status >= 400) {
    throw new Error(`Gasless Transfer Request Failed.\
      Status Code: ${apiResponse.status}.\
      Error: ${JSON.stringify(apiResponse.value)}`,
    );
  }
  return { txHash: apiResponse.value.data.hash as `0x${string}` };
}
