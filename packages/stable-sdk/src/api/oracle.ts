
import { deserializeBigints, SerializedBigint } from "@stable-io/utils";
import { Network } from "../types/index.js";
import { apiRequest, apiEndpoint, APIResponse, apiEndpointWithQuery } from "./index.js"
import { EvmDomains } from "@stable-io/cctp-sdk-definitions";

export type GetDomainPricesParams = {
  domain: keyof EvmDomains;
};

export type DomainPrices = {
  gasTokenPriceAtomicUsdc: bigint,
  gasPriceAtomic: bigint,
}

type SerializedDomainPrices = {
  [key in keyof DomainPrices]: SerializedBigint
}

export async function getDomainPrices(
  network: Network,
  params: GetDomainPricesParams,
): Promise<DomainPrices> {
  const endpoint = apiEndpointWithQuery(network)(`oracle/price`, params);

  const apiResponse = await apiRequest<APIResponse<200, {data: SerializedDomainPrices}>>(endpoint, { method: "GET" });

  if (apiResponse.status >=400) throw new Error("Failed to get Prices from Oracle API");

  const parsedResult = deserializeBigints(apiResponse.value.data);

  return parsedResult as DomainPrices;
}