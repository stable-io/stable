import { deserializeBigints, SerializedBigint } from "@stable-io/utils";
import { Network } from "../types/index.js";
import { apiRequest, HTTPCode, APIResponse, apiEndpointWithQuery } from "./index.js";
import { EvmDomains } from "@stable-io/cctp-sdk-definitions";

export type GetDomainPricesParams = {
  domain: keyof EvmDomains;
};

export type DomainPrices = {
  gasTokenPriceAtomicUsdc: bigint;
  gasPriceAtomic: bigint;
};

type SerializedDomainPrices = {
  [key in keyof DomainPrices]: SerializedBigint
};

export async function getDomainPrices(
  network: Network,
  params: GetDomainPricesParams,
): Promise<DomainPrices> {
  const endpoint = apiEndpointWithQuery(network)(`oracle/price`, params);

  const apiResponse = await apiRequest<
    APIResponse<HTTPCode, { data: SerializedDomainPrices }>
  >(endpoint, { method: "GET" });

  if (apiResponse.status >=400)
      throw new Error(`Failed to get Prices from Oracle API. Status Code: ${apiResponse.status}`);

  const parsedResult = deserializeBigints(apiResponse.value.data);

  return parsedResult as DomainPrices;
}
