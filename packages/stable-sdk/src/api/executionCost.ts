import { deserializeBigints, SerializedBigint } from "@stable-io/utils";
import { Network } from "../types/index.js";
import { apiRequest, apiEndpoint, APIResponse } from "./index.js";

export type GetExecutionCostsParams = {
  platform: "Evm"; // | "Solana" ...
};

export type EvmExecutionCosts = {
  permit: bigint;
  multiCall: bigint;
  v1: bigint;
  v2: bigint;
  v1Gasless: bigint;
  v2Gasless: bigint;
};
type SerializedEvmExecutionCosts = {
  [key in keyof EvmExecutionCosts]: SerializedBigint
};

export type ExecutionCostsResponse = EvmExecutionCosts; // | SolanaExecutionCosts...

export async function getPlatformExecutionCosts<P extends "Evm">(
  network: Network,
  platformName: P,
): Promise<ExecutionCostsResponse> {
  const endpoint = apiEndpoint(network)(`execution-cost/${platformName}`);

  const apiResponse = await apiRequest<APIResponse<200, { data: SerializedEvmExecutionCosts }>>(endpoint, { method: "GET" });

  if (apiResponse.status >= 400) {
    throw new Error(`API Call To Get Execution Cost Failed With Status: ${apiResponse.status}`);
  }

  const parsedResult = deserializeBigints(apiResponse.value.data);

  return parsedResult as EvmExecutionCosts;
}
