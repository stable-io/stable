import { HTTPCode, RegisteredPlatform } from "@stable-io/cctp-sdk-definitions";
import { deserializeBigints, SerializedBigint } from "@stable-io/utils";
import { Network } from "../types/index.js";
import { apiRequest, apiEndpoint, APIResponse } from "./base.js";

export type GetExecutionCostsParams = {
  platform: "Evm" | "Solana";
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

export type SolanaExecutionCosts = {
  v1: bigint;
  v2: bigint;
  v1Gasless: bigint;
  v2Gasless: bigint;
};

type SerializedSolanaExecutionCosts = {
  [key in keyof SolanaExecutionCosts]: SerializedBigint
};

type SerializedExecutionCosts<P extends RegisteredPlatform> =
  P extends "Evm" ? SerializedEvmExecutionCosts :
  P extends "Solana" ? SerializedSolanaExecutionCosts :
  never;

export type ExecutionCostsResponse<P extends RegisteredPlatform> =
  P extends "Evm" ? EvmExecutionCosts :
  P extends "Solana" ? SolanaExecutionCosts :
  never;

export async function getPlatformExecutionCosts<P extends RegisteredPlatform>(
  network: Network,
  platformName: P,
): Promise<ExecutionCostsResponse<P>> {
  const endpoint = apiEndpoint(network)(`execution-cost/${platformName}`);

  const apiResponse = await apiRequest<APIResponse<HTTPCode, { data: SerializedExecutionCosts<P> }>>(endpoint, { method: "GET" });

  if (apiResponse.status >= 400) {
    throw new Error(`API Call To Get Execution Cost Failed With Status: ${apiResponse.status}`);
  }

  const parsedResult = deserializeBigints(apiResponse.value.data);

  return parsedResult as ExecutionCostsResponse<P>;
}
