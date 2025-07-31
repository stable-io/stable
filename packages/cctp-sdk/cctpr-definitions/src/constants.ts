// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { MapLevels } from "@stable-io/map-utils";
import { constMap } from "@stable-io/map-utils";
import type { Domain, Network } from "@stable-io/cctp-sdk-definitions";

export const contractAddressEntries = [[
  "Mainnet", [
    ["Ethereum",   "0xb431afb0a1408bb832addfe6d443b8b0ed81cf66"],
    ["Avalanche",  "0x88e4a723da9460de2886a5f978fb1e74c3a6f3ae"],
    ["Optimism",   "0x88e4a723da9460de2886a5f978fb1e74c3a6f3ae"],
    ["Arbitrum",   "0xb431afb0a1408bb832addfe6d443b8b0ed81cf66"],
    ["Base",       "0xb431afb0a1408bb832addfe6d443b8b0ed81cf66"],
    ["Solana",     undefined],
    ["Polygon",    "0xb431afb0a1408bb832addfe6d443b8b0ed81cf66"],
    // ["Sui",        undefined],
    // ["Aptos",      undefined],
    ["Unichain",   "0xb431afb0a1408bb832addfe6d443b8b0ed81cf66"],
    ["Linea",      undefined],
    ["Codex",      undefined],
    ["Sonic",      undefined],
    ["Worldchain", undefined],
  ]], [
  "Testnet", [
    ["Ethereum",   "0x00caba778ceb384e81fcb4914f958247caad9ef5"],
    ["Avalanche",  "0xc56ec809bb285cd69ddc9e99e6a46975d04527c7"],
    ["Optimism",   "0x00caba778ceb384e81fcb4914f958247caad9ef5"],
    ["Arbitrum",   "0x00caba778ceb384e81fcb4914f958247caad9ef5"],
    ["Base",       "0x00caba778ceb384e81fcb4914f958247caad9ef5"],
    // ["Solana",     undefined],
    ["Polygon",    "0x00caba778ceb384e81fcb4914f958247caad9ef5"],
    // ["Sui",        undefined],
    // ["Aptos",      undefined],
    ["Unichain",   "0x00caba778ceb384e81fcb4914f958247caad9ef5"],
    ["Linea",      undefined],
    ["Codex",      undefined],
    ["Sonic",      undefined],
    ["Worldchain", undefined],
  ]],
] as const satisfies MapLevels<[Network, Domain, string | undefined]>;

export const contractAddressOf = constMap(contractAddressEntries);

export const supportedDomains = constMap(contractAddressEntries, [0, 1]);
export type SupportedDomain<N extends Network> = ReturnType<typeof supportedDomains<N>>[number];

export const avaxRouterContractAddress = {
  Mainnet: "0xb431afb0a1408bb832addfe6d443b8b0ed81cf66",
  Testnet: "0x4cfa05575695dc4383973e02af0c261dec65a948",
} as const satisfies Record<Network, `0x${string}` | undefined>;

export const relayOverheadOf = {
  Mainnet: {
    Ethereum:  30, // TODO: Adjust
    Avalanche: 30, // TODO: Adjust
    Optimism:  30, // TODO: Adjust
    Arbitrum:  30, // TODO: Adjust
    Base:      30, // TODO: Adjust
    Solana:    30, // TODO: Adjust
    Polygon:   30, // TODO: Adjust
    Sui:       30, // TODO: Adjust
    Aptos:     30, // TODO: Adjust
    Unichain:  30, // TODO: Adjust
    Linea:     30, // TODO: Adjust
  },
  Testnet: {
    Ethereum:  6, // TODO: Adjust
    Avalanche: 6, // TODO: Adjust
    Optimism:  6, // TODO: Adjust
    Arbitrum:  6, // TODO: Adjust
    Base:      6, // TODO: Adjust
    Solana:    6, // TODO: Adjust
    Polygon:   6, // TODO: Adjust
    Sui:       6, // TODO: Adjust
    Aptos:     6, // TODO: Adjust
    Unichain:  6, // TODO: Adjust
    Linea:     6, // TODO: Adjust
  },
} as const satisfies Record<Network, Record<string, number>>;

export const gasDropoffLimitOf = {
  Mainnet: {
    Ethereum:   0.001509,
    Avalanche:  0.00151,
    Optimism:   0.00151,
    Arbitrum:   0.00151,
    Base:       0.00151,
    Solana:     0.15,
    Polygon:    0.00151,
    // Sui:        30,
    // Aptos:      30,
    Unichain:   0.00151,
    Linea:      0.00151,
    Codex:      0.00151,
    Sonic:      0.00151,
    Worldchain: 0.00151,
  },
  Testnet: {
    Ethereum:   0.00151,
    Avalanche:  0.00151,
    Optimism:   0.00151,
    Arbitrum:   0.00151,
    Base:       0.00151,
    Solana:     0.15,
    Polygon:    0.00151,
    // Sui:        30,
    // Aptos:      30,
    Unichain:   0.00151,
    Linea:      0.00151,
    Codex:      0.00151,
    Sonic:      0.00151,
    Worldchain: 0.00151,
  },
} as const satisfies Record<Network, Record<SupportedDomain<Network>, number>>;

export const init = <N extends Network>(network: N) => ({
  contractAddressOf: contractAddressOf.subMap(network),
  supportedDomains: supportedDomains(network),
  avaxRouterContractAddress: avaxRouterContractAddress[network],
  relayOverheadOf: relayOverheadOf[network],
  gasDropoffLimitOf: gasDropoffLimitOf[network],
} as const);
