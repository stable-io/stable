// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { SuppressExpansion } from "@stable-io/utils";
import { deepReadonly, column, constMap, RoArray } from "@stable-io/map-utils";
import type { Domain, ExpandedDomain, SimplifyDomain } from "./domains.js";

export const platformDomainEntries = [[
  "Evm", [
    "Ethereum",
    "Avalanche",
    "Optimism",
    "Arbitrum",
    "Base",
    "Polygon",
    "Unichain",
    "Linea",
    "Sonic",
  ]], [
  "Cosmwasm", [
    "Noble",
  ]], [
  "Solana", [
    "Solana",
  ]], [
  "Sui", [
    "Sui",
  ]], [
  "Aptos", [
    "Aptos",
  ]],
] as const;

export const platforms = deepReadonly(column(platformDomainEntries, 0));
export type Platform = typeof platforms[number];

export const domainsOf = constMap(platformDomainEntries);
type ExpandedDomainsOf<P extends Platform> = ReturnType<typeof domainsOf<P>>[number];
export type DomainsOf<P extends Platform> = SimplifyDomain<ExpandedDomainsOf<P>>;

export const platformOf = constMap(platformDomainEntries, [1, 0]);
//we use ExpandedDomain instead of just Domain here to avoid confusing circular dependency
//  errors when mistyping a domain (e.g. "EVM" instead of "Evm")
export type PlatformOf<D extends ExpandedDomain> = ReturnType<typeof platformOf<D>>;

export interface EvmDomains extends SuppressExpansion<ExpandedDomainsOf<"Evm">> {}

export const isEvmDomain = (domain: Domain): domain is DomainsOf<"Evm"> =>
  (domainsOf("Evm") as RoArray<Domain>).includes(domain);

declare module "../../registry.js" {
  export interface DomainAliases {
    EvmDomains: [ExpandedDomainsOf<"Evm">, EvmDomains];
  }
}

//must fit in a universal address, hence at most 32 bytes
const platformAddressFormatEntries = [
  ["Evm",      [20, "hex"]],
  ["Cosmwasm", [32, "bech32"]],
  ["Solana",   [32, "base58"]],
  ["Sui",      [32, "hex"]],
  ["Aptos",    [32, "hex"]],
] as const satisfies [Platform, [byteSize: number, format: string]][];

export const addressFormatOf = constMap(platformAddressFormatEntries);
export type AddressFormatOf<P extends Platform> = ReturnType<typeof addressFormatOf<P>>;
