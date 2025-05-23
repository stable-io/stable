// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ApiVersion, Domain, Network, Usdc, Duration, Percentage } from "../../constants/index.js";
import { usdc, domainIdOf, percentage } from "../../constants/index.js";
import { apiEndpoint, apiEndpointWithQuery } from "../../constants/apis.js";
import { fetchApiResponse, HTTPCode, APIResponse } from "../../api.js";
import { Brand, encoding, TODO } from "@stable-io/utils";

type GenericErrorValue = Readonly<{
  error: string;
}>;

type GenericErrorValueWithCode = Readonly<{
  code: number;
  error: string;
}>;

type FastBurnAllowanceRawResponse = APIResponse<200, Readonly<{
  allowance: number;
  lastUpdated: string;
}>>;

export type FastBurnAllowanceResponse = Readonly<{
  allowance: Usdc;
  lastUpdated: Date;
}>;

type FastBurnFeeRawResponse = APIResponse<200, Readonly<{ minimumFee: number }>>;

export type FastBurnFeeResponse = Readonly<{ minimumFee: Percentage }>;

type GetMessagesValueSuccess = Readonly<{
  messages: ReadonlyArray<{
    message: string;
    eventNonce: string;
    attestation: string;
    decodedMessage?: Readonly<{
      sourceDomain: number;
      destinationDomain: number;
      nonce: string;
      sender: string;
      recipient: string;
      destinationCaller: string;
      messageBody: string;
      decodedMessageBody: Readonly<{
        burnToken: string;
        mintRecipient: string;
        amount: number;
        messageSender: string;
        // These optional fields are only on V2
        maxFee?: number;
        feeExecuted?: number;
        expirationBlock?: number;
        hookData?: string;
      }>;
    }>;
    cctpVersion: number;
    status: string;
  }>;
}>;

type GetMessagesRawResponse<H extends HTTPCode> =
  H extends 200 ? APIResponse<H, GetMessagesValueSuccess> :
  H extends 400 ? APIResponse<H, GenericErrorValue> :
  H extends 404 ? APIResponse<H, GenericErrorValueWithCode> :
  never;

export type MessageStatus = "complete" | "pending_confirmations";
// For v1 messages the nonce is an integer, for v2 messages the nonce is a 32 byte hex hash
export type CCTPNonce = Brand<string, "CCTPNonce">;

export type GetMessagesResponse = Readonly<{
  status: "success";
  messages: ReadonlyArray<{
    message: Uint8Array;
    eventNonce: CCTPNonce;
    attestation: Uint8Array;
    /* @todo: Define this properly later, but it is optional if empty or if it fails to decode */
    decodedMessage?: TODO;
    cctpVersion: ApiVersion;
    status: MessageStatus;
  }>;
} | {
  status: "not_found";
  /* @todo: Not sure what the error code is */
  code: number;
  error: string;
}>;

export type TxHashOrNonce = { transactionHash: string } | { nonce: string };

export const fetchFastBurnAllowanceFactory = <N extends Network>(network: N) => async (
  ttl?: Duration,
): Promise<FastBurnAllowanceResponse> => {
  const endpoint = apiEndpoint(network)(2 as ApiVersion, "fastBurn", "USDC", "allowance");
  const response = await fetchApiResponse<FastBurnAllowanceRawResponse>(endpoint, ttl);
  return {
    allowance: usdc(response.value.allowance),
    lastUpdated: new Date(response.value.lastUpdated),
  };
};

export const fetchFastBurnFeeFactory = <N extends Network>(network: N) => async (
  sourceDomain: Domain,
  destinationDomain: Domain,
  ttl?: Duration,
): Promise<FastBurnFeeResponse> => {
  const sourceDomainId = domainIdOf(sourceDomain);
  const destinationDomainId = domainIdOf(destinationDomain);
  const endpoint = apiEndpoint(network)(
    2 as ApiVersion,
    "fastBurn",
    "USDC",
    "fees",
    sourceDomainId.toString(10),
    destinationDomainId.toString(10),
  );
  const response = await fetchApiResponse<FastBurnFeeRawResponse>(endpoint, ttl);
  return { minimumFee: percentage(response.value.minimumFee, "bp") };
};

export const fetchMessagesFactory = <N extends Network>(network: N) => async (
  sourceDomain: Domain,
  txHashOrNonce: TxHashOrNonce,
  ttl?: Duration,
): Promise<GetMessagesResponse> => {
  const sourceDomainId = domainIdOf(sourceDomain);
  const endpoint = apiEndpointWithQuery(network)(
    2 as ApiVersion,
    txHashOrNonce,
    "messages",
    sourceDomainId.toString(10),
  );
  const response = await fetchApiResponse<GetMessagesRawResponse<HTTPCode>>(endpoint, ttl);
  if (response.status === 400) {
    throw new Error("The GetMessages request was malformed");
  }
  if (response.status === 404) {
    return { status: "not_found", ...response.value };
  }
  return {
    status: "success",
    messages: response.value.messages.map(message => ({
      message: encoding.hex.decode(message.message),
      eventNonce: message.eventNonce as CCTPNonce,
      attestation: encoding.hex.decode(message.attestation),
      decodedMessage: message.decodedMessage,
      cctpVersion: message.cctpVersion as ApiVersion,
      status: message.status as MessageStatus,
    })),
  };
};

export const init = <N extends Network>(network: N) => ({
  fetchFastBurnAllowance: fetchFastBurnAllowanceFactory(network),
  fetchFastBurnFee: fetchFastBurnFeeFactory(network),
  fetchMessages: fetchMessagesFactory(network),
} as const);
