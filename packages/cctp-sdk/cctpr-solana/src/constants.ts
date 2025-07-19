// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { MapLevels, Intersect } from "@stable-io/map-utils";
import { constMap, difference } from "@stable-io/map-utils";
import type { Network, Domain } from "@stable-io/cctp-sdk-definitions";
import {supportedDomains } from "@stable-io/cctp-sdk-cctpr-definitions";

export const oracleAddress = "xpo8sHWHkfS6NpVsYwE2t5pTvvdTHSdWUdxh2RtsT1H";

const domainOracleChainIdEntries = [[
  "Mainnet", [
    ["Ethereum",       2],
    ["Avalanche",      6],
    ["Optimism",      24],
    ["Arbitrum",      23],
    ["Base",          30],
    ["Polygon",        5],
    ["Sui",           21],
    ["Aptos",         22],
    ["Unichain",      44],
    ["Linea",         38],
    ["Codex",         54],
    ["Sonic",         52],
    ["Worldchain",    45],
  ]], [
  "Testnet", [
    ["Ethereum",   10002],
    ["Avalanche",      6],
    ["Optimism",   10005],
    ["Arbitrum",   10003],
    ["Base",       10004],
    ["Polygon",    10007],
    ["Sui",           21],
    ["Aptos",         22],
    ["Unichain",      44],
    ["Linea",         38],
    ["Codex",         54],
    ["Sonic",         52],
    ["Worldchain",    45],
  ]],
] as const satisfies MapLevels<[Network, Domain, number]>;

export const domainToOracleChainId = constMap(domainOracleChainIdEntries);
export const oracleChainIdToDomain = constMap(domainOracleChainIdEntries, [[0, 2], 1]);

export const foreignDomains = <N extends Network>(network: N) =>
  difference(supportedDomains(network), ["Solana"]);

type ForeignDomainRet<N extends Network> = ReturnType<typeof foreignDomains<N>>;
type SharedForeignDomain =
  Intersect<ForeignDomainRet<"Mainnet">, ForeignDomainRet<"Testnet">>[number];
export type ForeignDomain<N extends Network> = SharedForeignDomain | ForeignDomainRet<N>[number];

export const executionCosts = {
  Evm: {
    Gas: {
      avaxHop:    281_200,
      gasDropoff:  22_000,
      v1:         165_000,
      v2:         175_000,
    },
    TxBytes: {
      v1: 664,
      v2: 793,
    },
  },
  Sui: {
    ComputeUnits: {
      gasDropoff: 1_000,
      delivery:   2_000,
    },
    StorageBytes: {
      gasDropoff:   260,
      delivery:   2_363,
    },
    RebateBytes: {
      gasDropoff:   260,
      delivery:   1_979,
    }
  },
} as const;
