// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { DeriveType, Item, Layout } from "binary-layout";
import { enumItem } from "binary-layout";
import { zip, range } from "@stable-io/map-utils";
import { Rational } from "@stable-io/amount";
import {
  type Network,
  amountItem,
  domainItem,
  GenericGasToken,
  EvmGasToken,
  Usdc,
  domainsOf,
} from "@stable-io/cctp-sdk-definitions";
import { supportedDomains } from "@stable-io/cctp-sdk-cctpr-definitions";

export const gasDropoffItem = amountItem(4, GenericGasToken, "µGasToken");
export const usdcItem = amountItem(8, Usdc);
export const evmGasTokenItem = amountItem(16, EvmGasToken);

export const evmDomainItem = {
  ...domainItem(domainsOf("Evm")), size: 1,
} as const satisfies Item;

//we only use a single byte for domains because Circle is using incremental domain ids anyway
export const supportedDomainItem = <N extends Network>(network: N) => ({
  ...domainItem(supportedDomains(network)), size: 1, //TODO
} as const satisfies Item);

export const corridors = ["v1", "v2Direct", "avaxHop"] as const;
export type Corridor = typeof corridors[number];
export const corridorItem = enumItem(zip([corridors, range(corridors.length)]));

export const bakedInDomains = [
  "Ethereum", "Avalanche", "Optimism", "Arbitrum", "Noble", "Base",
  "Solana", "Polygon", "Sui", "Aptos", "Unichain", "Linea",
] as const;
export const extraDomains = <N extends Network>(network: N) =>
  ["Codex", "Sonic", "Worldchain"] as const; //TODO implement filter method to instead filter out baked in domains
export type ExtraDomain<N extends Network> = ReturnType<typeof extraDomains<N>>[number];

export type ExtraChainIds<N extends Network> = Partial<Record<ExtraDomain<N>, number>>;

export const domainChainIdPairLayout = <N extends Network>(network: N) => [
  { name: "domain", ...domainItem(extraDomains(network)) },
  { name: "chainId", binary: "uint", size: 2             },
] as const satisfies Layout;
export type DomainChainIdPair<N extends Network> =
  DeriveType<ReturnType<typeof domainChainIdPairLayout<N>>>;

export const feeAdjustmentTypes = [...corridors, "gasDropoff"] as const;
export type FeeAdjustmentType = typeof feeAdjustmentTypes[number];
