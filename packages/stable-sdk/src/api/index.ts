// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Url, BaseObject, encoding, deserializeBigints } from "@stable-io/utils";
import { Network } from "../types/index.js";
import { layouts } from "@stable-io/cctp-sdk-cctpr-evm";
import { EvmDomains, Usdc, GenericGasToken, usdc, genericGasToken, Percentage, percentage } from "@stable-io/cctp-sdk-definitions";
import { EvmAddress, Permit, Permit2TypedData } from "@stable-io/cctp-sdk-evm";

export const apiUrl = {
  Mainnet: "", // TODO
  Testnet: "https://api.stg.stableit.com",
} as const satisfies Record<Network, string>;

export const apiEndpoint = <N extends Network>(network: N) => (
  path: string,
): Url => {
  const apiUrlBase = process.env.STABLE_SDK_GASLESS_API_URL || apiUrl[network];
  return `${apiUrlBase}/${path}` as Url;
};

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

export * from "./gasless.js";
