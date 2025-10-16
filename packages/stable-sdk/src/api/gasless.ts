// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { encoding, deserializeBigints } from "@stable-io/utils";
import type { CctprRecipientAddress, Corridor, SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";
import type { Permit2GaslessData } from "@stable-io/cctp-sdk-cctpr-evm";
import {
  LoadedDomain,
  Usdc,
  GenericGasToken,
  usdc,
  genericGasToken,
  Percentage,
  percentage,
  PlatformAddress,
  PlatformOf,
  UniversalAddress,
  platformAddress,
  platformOf,
} from "@stable-io/cctp-sdk-definitions";
import type { Permit } from "@stable-io/cctp-sdk-evm";
import type { Network } from "../types/index.js";
import { apiEndpointWithQuery, apiRequest, apiEndpoint, HTTPCode, APIResponse } from "./base.js";
import type { SignableEncodedBase64Message } from "@stable-io/cctp-sdk-cctpr-solana";

export type GetQuoteParams<
  N extends Network,
  S extends LoadedDomain,
  D extends SupportedDomain<N>,
> = {
  sourceChain: S;
  targetChain: D;
  amount: Usdc;
  sender: PlatformAddress<PlatformOf<S>>;
  recipient: CctprRecipientAddress<N, D>;
  corridor: Corridor;
  gasDropoff: GenericGasToken;
  permit2PermitRequired: boolean;
  maxRelayFee: Usdc;
  fastFeeRate: Percentage;
  takeFeesFromInput: boolean;
};

export type GetQuoteResponse<
  N extends Network,
  S extends LoadedDomain,
  D extends SupportedDomain<N>,
> = {
  iat: number;
  exp: number;
  quoteRequest: GetQuoteParams<N, S, D>;
  gaslessFee: Usdc;
  jwt: string;
  permit2GaslessData?: Permit2GaslessData;
  solanaMessage?: SignableEncodedBase64Message;
} | undefined;

export async function getTransferQuote<
  N extends Network,
  S extends LoadedDomain,
  D extends SupportedDomain<N>,
>(
  network: Network,
  quoteParams: GetQuoteParams<N, S, D>,
): Promise<GetQuoteResponse<N, S, D>> {
  const apiParams: Record<string, string> = serializeQuoteRequest(quoteParams);

  const endpoint = apiEndpointWithQuery(network)("gasless-transfer/quote", apiParams);

  const apiResponse = await apiRequest(endpoint, { method: "GET" });

  if (apiResponse.status >= 400) {
    console.error(`GET Quote failed with status ${apiResponse.status}`);
    for (const msg of apiResponse.value["message"] ?? []) {
      console.error(msg);
    }
    return undefined;
  }

  const jwt = extractJwtFromQuoteResponse(apiResponse.value);

  const payload = decodeAndDeserializeJwt(jwt);
  if (payload.willRelay === false) {
    return undefined;
  }

  const quoteRequest = deserializeQuoteRequest<N, S, D>(
    payload.quoteRequest as Record<string, unknown>,
  );
  const gaslessFee = usdc(payload.gaslessFee! as string);
  return {
    iat: payload.iat as number,
    exp: payload.exp as number,
    quoteRequest,
    gaslessFee,
    jwt,
    solanaMessage: quoteParams.sourceChain === "Solana" ? payload.solanaMessage as SignableEncodedBase64Message : undefined,
    permit2GaslessData: quoteParams.sourceChain === "Solana" ? undefined : payload.permit2GaslessData as Permit2GaslessData,
  };
}

function serializeQuoteRequest<
  N extends Network,
  S extends LoadedDomain,
  D extends SupportedDomain<N>,
>(
  params: GetQuoteParams<N, S, D>,
): Record<string, string> {
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
    maxRelayFee: params.maxRelayFee.toUnit("human").toFixed(6),
    fastFeeRate: params.corridor === "v2Direct"
      ? params.fastFeeRate.toUnit("human").toString()
      : "0",
  };
}

function deserializeQuoteRequest<
  N extends Network,
  S extends LoadedDomain,
  D extends SupportedDomain<N>,
>(
  responseQuoteParams: Record<string, unknown>,
): GetQuoteParams<N, S, D> {
  const destinationPlatform = platformOf(responseQuoteParams.targetDomain as D);
  return {
    sourceChain: responseQuoteParams.sourceDomain as S,
    targetChain: responseQuoteParams.targetDomain as D,
    permit2PermitRequired: responseQuoteParams.permit2PermitRequired as boolean,
    amount: usdc(responseQuoteParams.amount as string, "human"),
    sender: platformAddress(
      responseQuoteParams.sourceDomain as S,
      responseQuoteParams.sender as string,
    ),
    recipient: platformAddress(
      responseQuoteParams.targetDomain as D,
      responseQuoteParams.recipient as string,
    ),
    gasDropoff: genericGasToken(responseQuoteParams.gasDropoff as string, "human"),
    corridor: responseQuoteParams.corridor as Corridor,
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
    jwt,
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
