import { Injectable } from "@nestjs/common";
import { Platform } from "@stable-io/cctp-sdk-definitions";

const EVM_KNOWN_EXECUTION_COSTS = {
  permit: 20_081n,
  multiCall: 74_321n,
  v1: 160_505n,
  v2: 170_148n,
  v1Gasless: 179257n,
  v2Gasless: 188439n,
} as const;

export type EvmExecutionCosts = typeof EVM_KNOWN_EXECUTION_COSTS;

const SOLANA_KNOWN_EXECUTION_COSTS = {
  v1: 160_505n,
  v2: 170_148n,
  v1Gasless: 179257n,
  v2Gasless: 188439n,
} as const;

export type SolanaExecutionCosts = typeof SOLANA_KNOWN_EXECUTION_COSTS;

@Injectable()
export class ExecutionCostService {
  /**
   * Get known execution cost estimates for a specific platform
   */
  public getKnownEstimates(platform: "Evm"): EvmExecutionCosts;
  public getKnownEstimates(platform: "Solana"): SolanaExecutionCosts;
  public getKnownEstimates(
    platform: Platform,
  ): EvmExecutionCosts | SolanaExecutionCosts | undefined;
  public getKnownEstimates(
    platform: Platform,
  ): EvmExecutionCosts | SolanaExecutionCosts | undefined {
    switch (platform) {
      case "Evm":
        return EVM_KNOWN_EXECUTION_COSTS;
      case "Solana":
        return SOLANA_KNOWN_EXECUTION_COSTS;
      default:
        return undefined;
    }
  }

  public getSupportedPlatforms(): Platform[] {
    return ["Evm", "Solana"];
  }
}
