// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { MapLevels } from "@stable-io/map-utils";
import { constMap } from "@stable-io/map-utils";
import type { Domain, Network } from "@stable-io/cctp-sdk-definitions";

export const contractAddressEntries = [[
  //TODO
  "Mainnet", [
    ["Ethereum",   undefined],
    ["Avalanche",  undefined],
    ["Optimism",   undefined],
    ["Arbitrum",   undefined],
    ["Base",       undefined],
    // ["Solana",     undefined],
    ["Polygon",    undefined],
    // ["Sui",        undefined],
    // ["Aptos",      undefined],
    ["Unichain",   undefined],
    ["Linea",      undefined],
    ["Codex",      undefined],
    ["Sonic",      undefined],
    ["Worldchain", undefined],
  ]], [
  "Testnet", [
    ["Ethereum",   "0x6f15237908e4f284eaddaa5d10d94ea5988f2010"],
    ["Avalanche",  "0x00caba778ceb384e81fcb4914f958247caad9ef5"],
    ["Optimism",   "0x6f15237908e4f284eaddaa5d10d94ea5988f2010"],
    ["Arbitrum",   "0x6f15237908e4f284eaddaa5d10d94ea5988f2010"],
    ["Base",       "0x6f15237908e4f284eaddaa5d10d94ea5988f2010"],
    // ["Solana",     undefined],
    ["Polygon",    "0x6f15237908e4f284eaddaa5d10d94ea5988f2010"],
    // ["Sui",        undefined],
    // ["Aptos",      undefined],
    ["Unichain",   "0x6f15237908e4f284eaddaa5d10d94ea5988f2010"],
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
  Mainnet: "0x", //TODO
  Testnet: "0x6f097674abc0895f9ec2cff13c8312492cf09815",
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
    // Solana:     30,
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
    Ethereum:   0.01509,
    Avalanche:  0.00151,
    Optimism:   0.00151,
    Arbitrum:   0.00151,
    Base:       0.00151,
    // Solana:     30,
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
