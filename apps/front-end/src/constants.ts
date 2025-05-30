import type { EvmChains } from "@stable-io/sdk";

export const availableChains = [
  "Ethereum",
  "Arbitrum",
  "Optimism",
  "Base",
  // "Polygon",
  // "Unichain",
  // "Avalanche",
] as const satisfies readonly EvmChains[];

export type AvailableChains = (typeof availableChains)[number];

export const chainLogos = {
  Ethereum: "/imgs/eth-logo.svg",
  Arbitrum: "/imgs/arb-logo.svg",
  Optimism: "/imgs/op-logo.svg",
  Base: "/imgs/tmp/base-logo.png",
  // Polygon: "/imgs/tmp/pol-logo.png",
  // Unichain: "/imgs/uni-logo.png",
  // Avalanche: "/imgs/tmp/ava-logo.png",
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
