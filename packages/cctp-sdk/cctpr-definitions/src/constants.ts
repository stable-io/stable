// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { MapLevels } from "@stable-io/map-utils";
import { constMap } from "@stable-io/map-utils";
import type { Domain, Network } from "@stable-io/cctp-sdk-definitions";

export const contractAddressEntries = [[
  "Mainnet", [
    ["Ethereum",   "0xc8974200fadb96be23cea557dac23f1b25b21c7a"],
    ["Avalanche",  "0xc8974200fadb96be23cea557dac23f1b25b21c7a"],
    ["Optimism",   "0xc8974200fadb96be23cea557dac23f1b25b21c7a"],
    ["Arbitrum",   "0xc8974200fadb96be23cea557dac23f1b25b21c7a"],
    ["Base",       "0xc8974200fadb96be23cea557dac23f1b25b21c7a"],
    ["Solana",     undefined],
    ["Polygon",    "0xc8974200fadb96be23cea557dac23f1b25b21c7a"],
    // ["Sui",        undefined],
    // ["Aptos",      undefined],
    ["Unichain",   "0xc8974200fadb96be23cea557dac23f1b25b21c7a"],
    ["Linea",      "0xc8974200fadb96be23cea557dac23f1b25b21c7a"],
    ["Codex",      undefined],
    ["Sonic",      "0xc8974200fadb96be23cea557dac23f1b25b21c7a"],
    ["Worldchain", "0xc8974200fadb96be23cea557dac23f1b25b21c7a"],
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
  Mainnet: "0x80af48cb7e3c18da42d151f7c1aa215e63bfd8f0",
  Testnet: "0x4cfa05575695dc4383973e02af0c261dec65a948",
} as const satisfies Record<Network, `0x${string}` | undefined>;

export const relayOverheadOf = {
  Mainnet: {
    Ethereum:   12.35,
    Avalanche:  8.32,
    Optimism:   5.92,
    Arbitrum:   4.49,
    Base:       5.34,
    Polygon:    7.22,
    Solana:     6, // TODO: Adjust
    Sui:        6, // TODO: Adjust
    Aptos:      6, // TODO: Adjust
    Unichain:   6.45,
    Linea:      7.22,
    Sonic:      6.95,
    Worldchain: 6.59,
  },
  Testnet: {
    Ethereum:  13.2,
    Avalanche: 5.27,
    Optimism:  3.05,
    Arbitrum:  2.78,
    Base:      3.11,
    Polygon:   3.49,
    Solana:    6, // TODO: Adjust
    Sui:       6, // TODO: Adjust
    Aptos:     6, // TODO: Adjust
    Unichain:  7.73,
    Linea:     6.06,
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
