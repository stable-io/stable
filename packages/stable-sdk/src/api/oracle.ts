// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { LoadedDomain } from "@stable-io/cctp-sdk-definitions";
import { deserializeBigints, SerializedBigint } from "@stable-io/utils";
import type { Network } from "../types/index.js";
import { apiEndpointWithQuery, apiRequest, APIResponse, HTTPCode } from "./base.js";

export type GetDomainPricesParams<D extends LoadedDomain> = {
  domain: D;
};

export type EvmDomainPrices = {
  gasTokenPriceAtomicUsdc: bigint;
  gasPriceAtomic: bigint;
};

export type SolanaDomainPrices = {
  gasTokenPriceAtomicUsdc: bigint;
  pricePerAccountByteAtomicLamports: bigint;
  signaturePriceAtomicLamports: bigint;
  computationPriceAtomicMicroLamports: bigint;
};

export type SuiDomainPrices = {
  gasTokenPriceAtomicUsdc: bigint;
  computationPriceAtomicMIST: bigint;
  storagePriceAtomicMIST: bigint;
  storageRebateScalar: bigint;
};

export type DomainPrices<D extends LoadedDomain> =
  D extends "Solana" ? SolanaDomainPrices :
  D extends "Sui" ? SuiDomainPrices :
  EvmDomainPrices;

type SerializedDomainPrices<D extends LoadedDomain> = {
  [key in keyof DomainPrices<D>]: SerializedBigint
};

type ErrorResponse = APIResponse<Exclude<HTTPCode, 200>, { message: string }>;
type SuccessResponse<D extends LoadedDomain> =
  APIResponse<200, { data: SerializedDomainPrices<D> }>;
type Response<D extends LoadedDomain> = SuccessResponse<D> | ErrorResponse;

export async function getDomainPrices<D extends LoadedDomain>(
  network: Network,
  params: GetDomainPricesParams<D>,
): Promise<DomainPrices<D>> {
  const endpoint = apiEndpointWithQuery(network)(`oracle/price`, params);

  const apiResponse = await apiRequest<Response<D>>(endpoint, { method: "GET" });

  if (apiResponse.status != 200) {
    const details = `Status Code: ${apiResponse.status} Message: ${apiResponse.value.message}`;
    throw new Error(`Failed to get Prices from Oracle API. ${details}`);
  }

  const parsedResult = deserializeBigints(apiResponse.value.data);

  return parsedResult as DomainPrices<D>;
}
