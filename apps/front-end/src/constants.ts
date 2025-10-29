// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

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
  "Sonic",
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
export const gasDropoffs = {
  zero: "0",
  low: "0.0001",
  avg: "0.0005",
  high: "0.001",
} as const satisfies Record<GasDropoffLevel, string>;

export type StepStatus = "pending" | "inProgress" | "complete" | "failed";
