// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { MapLevels } from "@stable-io/map-utils";
import { constMap } from "@stable-io/map-utils";
import type { Network } from "./networks.js";
import type { Domain } from "./domains.js";

const domainChainIdEntries = [[
  "Mainnet", [
    ["Ethereum",   1n],
    ["Avalanche",  43114n],
    ["Optimism",   10n],
    ["Arbitrum",   421613n],
    ["Noble",      "noble-1"],
    ["Solana",     "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"],
    ["Base",       84531n],
    ["Polygon",    137n],
    ["Sui",        "35834a8a"],
    ["Aptos",      1n],
    ["Unichain",   130n],
    ["Linea",      59144n],
    ["Sonic",      146n],
    ["Worldchain", 480n],
  ]], [
  "Testnet", [
    ["Ethereum",   11155111n],
    ["Avalanche",  43113n],
    ["Optimism",   11155420n],
    ["Arbitrum",   421614n],
    ["Noble",      "grand-1"],
    ["Solana",     "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"],
    ["Base",       84532n],
    ["Polygon",    80002n],
    ["Sui",        "4c78adac"],
    ["Aptos",      2n],
    ["Unichain",   1301n],
    ["Linea",      59141n],
    ["Sonic",      57054n],
    ["Worldchain", 4801n],
  ]],
] as const satisfies MapLevels<[Network, Domain, bigint | string]>;

const domainWormholeChainIdEntries = [[
  "Mainnet", [
    ["Ethereum",   2],
    ["Avalanche",  6],
    ["Optimism",   24],
    ["Arbitrum",   23],
    ["Noble",      4009],
    ["Solana",     1],
    ["Base",       30],
    ["Polygon",    5],
    ["Sui",        21],
    ["Aptos",      22],
    ["Unichain",   44],
    ["Linea",      41],
    ["Codex",      54],
    ["Sonic",      52],
    ["Worldchain", 45],
  ]], [
  "Testnet", [
    ["Ethereum",   10002],
    ["Avalanche",  6],
    ["Optimism",   10005],
    ["Arbitrum",   10003],
    ["Noble",      4009],
    ["Solana",     1],
    ["Base",       10004],
    ["Polygon",    10007],
    ["Sui",        21],
    ["Aptos",      22],
    ["Unichain",   44],
    ["Linea",      38],
    // TODO: Add Codex when it is available
    ["Sonic",      52],
    ["Worldchain", 45],
  ]],
] as const satisfies MapLevels<[Network, Domain, number]>;

export const chainIdOf = constMap(domainChainIdEntries);
export const domainOfChainId = constMap(domainChainIdEntries, [[0, 2], 1]);

export const wormholeChainIdOf = constMap(domainWormholeChainIdEntries);
export const domainOfWormholeChainId = constMap(domainWormholeChainIdEntries, [[0, 2], 1]);
export type WormholeChainId = ReturnType<typeof wormholeChainIdOf>;

export const init = <N extends Network>(network: N) => ({
  chainIdOf: chainIdOf.subMap(network),
  domainOfChainId: domainOfChainId.subMap(network),
  wormholeChainIdOf: wormholeChainIdOf.subMap(network),
  domainOfWormholeChainId: domainOfWormholeChainId.subMap(network),
} as const);
