import type { EvmChains } from "@stable-io/sdk";

export const availableChains = [
  "Ethereum",
  "Polygon",
  "Avalanche",
  "Arbitrum",
  "Optimism",
  "Base",
  "Linea",
  "Unichain",
  "Worldchain",
  "Sonic"
] as const satisfies readonly EvmChains[];

export type AvailableChains = (typeof availableChains)[number];

export const chainLogos = {
  Ethereum: "/imgs/eth-logo.svg",
  Polygon: "/imgs/tmp/pol-logo.png",
  Avalanche: "/imgs/tmp/ava-logo.png",
  Arbitrum: "/imgs/arb-logo.svg",
  Optimism: "/imgs/op-logo.svg",
  Base: "/imgs/tmp/base-logo.png",
  Linea: "/imgs/linea-logo.png",
  Unichain: "/imgs/uni-logo.png",
  Worldchain: "/imgs/worldchain-logo.png",
  Sonic: "/imgs/sonic-logo.png",
} as const satisfies Record<AvailableChains, string>;

export type GasDropoffLevel = "zero" | "low" | "avg" | "high";

// @todo: Update with actual values, probably dependent on the chain
export const maxGasDropoff = 10n ** 15n; // eg 0.001 ETH
export const gasDropoffs = {
  zero: 0n,
  low: maxGasDropoff / 3n,
  avg: (maxGasDropoff * 2n) / 3n,
  high: maxGasDropoff,
} as const satisfies Record<GasDropoffLevel, bigint>;

export type StepStatus = "pending" | "inProgress" | "complete" | "failed";
