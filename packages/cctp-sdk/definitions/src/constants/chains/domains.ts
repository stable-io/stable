// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { SuppressExpansion } from "@stable-io/utils";
import { valueIndexEntries, deepReadonly, column, constMap } from "@stable-io/map-utils";
import { Aliased, DomainAliases } from "../../registry.js";

export const domains = [
  "Ethereum",
  "Avalanche",
  "Optimism",
  "Arbitrum",
  "Noble",
  "Solana",
  "Base",
  "Polygon",
  "Sui",
  "Aptos",
  "Unichain",
  "Linea",
  "Codex",
  "Sonic",
  "Worldchain",
  "Domain15",
  "Sei",
  "BNB",
  "XDC",
  "HyperEVM",
  "Domain20",
  "Ink",
  "Plume"
] as const;

export type ExpandedDomain = typeof domains[number];
export interface AllDomains extends SuppressExpansion<ExpandedDomain> {}
declare module "../../registry.js" {
  export interface DomainAliases {
    AllDomains: [ExpandedDomain, AllDomains];
  }
}
export type SimplifyDomain<D extends ExpandedDomain> = Aliased<DomainAliases, D>;
export type Domain = SimplifyDomain<ExpandedDomain>;

const domainIdEntries = deepReadonly(valueIndexEntries(domains));
const domainIds = deepReadonly(column(domainIdEntries, 1));
export type DomainId = typeof domainIds[number];

export const domainIdOf = constMap(domainIdEntries);
export const domainOf = constMap(domainIdEntries, [1, 0]);
