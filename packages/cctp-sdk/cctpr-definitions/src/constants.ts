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
    ["Ethereum",  undefined],
    ["Avalanche", undefined],
    ["Optimism",  undefined],
    ["Arbitrum",  undefined],
    ["Base",      undefined],
    // ["Solana",    undefined],
    ["Polygon",   undefined],
    // ["Sui",       undefined],
    // ["Aptos",     undefined],
    ["Unichain",  undefined],
    ["Linea",     undefined],
    ["Sonic",     undefined],
  ]], [
  "Testnet", [
    ["Ethereum",  "0xd60c838bcF9585B549f78bcf4903C950782DA13c"],
    ["Avalanche", "0x3b87De75dc34F02434468d361ca7A4a09b7e3072"],
    ["Optimism",  "0xeeD58C96245F920CF3a317258310C00dF6e41f72"],
    ["Arbitrum",  "0xeeD58C96245F920CF3a317258310C00dF6e41f72"],
    ["Base",      "0xd60c838bcF9585B549f78bcf4903C950782DA13c"],
    // ["Solana",    undefined],
    ["Polygon",   "0xeeD58C96245F920CF3a317258310C00dF6e41f72"],
    // ["Sui",       undefined],
    // ["Aptos",     undefined],
    ["Unichain",  "0x61a7DbC232C0Bf3ad1c81cBE0c7538D6a542E197"],
    ["Linea",     undefined],
    ["Sonic",     undefined],
  ]],
] as const satisfies MapLevels<[Network, Domain, string | undefined]>;

export const contractAddressOf = constMap(contractAddressEntries);

export const supportedDomains = constMap(contractAddressEntries, [0, 1]);
export type SupportedDomain<N extends Network> = ReturnType<typeof supportedDomains<N>>[number];

export const avaxRouterContractAddress = {
  Mainnet: undefined, //TODO
  Testnet: "0xdd7F26F2bA98DdAb89fdC041a3dB096aBd9CEFf6",
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
} as const satisfies Record<Network, Record<string, number>>;

export const gasDropoffLimitOf = {
  Mainnet: {
    Ethereum:  0.001509,
    Avalanche: 0.00151,
    Optimism:  0.00151,
    Arbitrum:  0.00151,
    Base:      0.00151,
    // Solana:    30,
    Polygon:   0.00151,
    // Sui:       30,
    // Aptos:     30,
    Unichain:  0.00151,
    Linea:     0.00151,
    Sonic: 0.00151,
  },
  Testnet: {
    Ethereum:  0.01509,
    Avalanche: 0.00151,
    Optimism:  0.00151,
    Arbitrum:  0.00151,
    Base:      0.00151,
    // Solana:    30,
    Polygon:   0.00151,
    // Sui:       30,
    // Aptos:     30,
    Unichain:  0.00151,
    Linea:     0.00151,
    Sonic: 0.00151,
  },
} as const satisfies Record<Network, Record<SupportedDomain<Network>, number>>;

export const init = <N extends Network>(network: N) => ({
  contractAddressOf: contractAddressOf.subMap(network),
  supportedDomains: supportedDomains(network),
  avaxRouterContractAddress: avaxRouterContractAddress[network],
  relayOverheadOf: relayOverheadOf[network],
  gasDropoffLimitOf: gasDropoffLimitOf[network],
} as const);
