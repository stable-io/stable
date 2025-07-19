// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { DeriveType, Item, NamedItem, Layout } from "binary-layout";
import { boolItem, enumItem } from "binary-layout";
import { type RoTuple, zip, range } from "@stable-io/map-utils";
import { type KindWithHuman, type KindWithAtomic, Rational } from "@stable-io/amount";
import type { Network, Domain, Platform } from "@stable-io/cctp-sdk-definitions";
import {
  domainItem,
  universalAddressItem,
  signatureItem,
  amountItem,
  GenericGasToken,
  byteSwitchItem,
  Usdc,
  domains,
  linearTransform,
  enumSwitchVariants,
} from "@stable-io/cctp-sdk-definitions";
import type { SupportedPlatformDomain } from "./constants.js";
import { supportedDomains, supportedPlatformDomains } from "./constants.js";

type ConstLayout = RoTuple<NamedItem>;
type GasTokenKind = KindWithHuman & KindWithAtomic;

export const gasDropoffItem = amountItem(4, GenericGasToken, "µGasToken");
export const usdcItem = amountItem(8, Usdc);

//we only use a single byte for domains because Circle is using incremental domain ids anyway
export const cctprDomainItem =
  <const DT extends RoTuple<Domain> = typeof domains>(domainTuple?: DT) =>
    ({ ...domainItem(domainTuple), size: 1 } as const satisfies Item);

export const supportedDomainItem = <N extends Network>(network: N) =>
  cctprDomainItem(supportedDomains(network));

//we need the explicit type to avoid tsc complaining about the inferred type being too long ts(7056)
type CctprPlatformDomainItem<N extends Network, P extends Platform> =
  ReturnType<typeof cctprDomainItem<SupportedPlatformDomain<N, P>>>;

export const cctprPlatformDomainItem =
  <N extends Network, const P extends Platform>(network: N, platform: P):
    CctprPlatformDomainItem<N, P> =>
      cctprDomainItem(supportedPlatformDomains(network, platform)) as any;

export const timestampItem = {
  binary: "uint", size: 4, custom: {
    to: (value: number) => new Date(value * 1000),
    from: (value: Date) => Math.floor(value.getTime() / 1000),
  },
} as const satisfies Item;

export const corridors = ["v1", "v2Direct", "avaxHop"] as const;
export type Corridor = typeof corridors[number];
export const corridorItem = enumItem(zip([corridors, range(corridors.length)]));

const maxFastFeeUsdcItem = { name: "maxFastFeeUsdc", ...usdcItem } as const;
const corridorVariants = zip([corridors, [[], [maxFastFeeUsdcItem], [maxFastFeeUsdcItem]]]);
export const corridorVariantItem = byteSwitchItem("type", enumSwitchVariants(corridorVariants));
export type CorridorVariant = DeriveType<typeof corridorVariantItem>;

export const feeAdjustmentTypes = [...corridors, "gasDropoff"] as const;
export type FeeAdjustmentType = typeof feeAdjustmentTypes[number];

export const routerHookDataLayout = <N extends Network>(network: N) => [
  { name: "destinationDomain", ...supportedDomainItem(network) },
  { name: "mintRecipient",     ...universalAddressItem         },
  { name: "gasDropoff",        ...gasDropoffItem               },
] as const satisfies Layout;

const relayFeeGasTokenItem = <const K extends GasTokenKind>(kind: K) =>
  amountItem(8, kind, linearTransform("to->from", 10n**9n)); //store in nano (gwei)

//both variants store their amount using 8 bytes
const relayFeeVariants = <const K extends GasTokenKind>(kind: K) => [
  ["usdc",     [{ name: "amount", ...usdcItem                   }]],
  ["gasToken", [{ name: "amount", ...relayFeeGasTokenItem(kind) }]],
] as const;

export const offChainRelayFeeVariantItem = <const K extends GasTokenKind>(kind: K) =>
  byteSwitchItem("payIn", enumSwitchVariants(relayFeeVariants(kind)));

export const offChainVariant = <const I extends Item>(relayFeeItem: I) => [
  "offChain", [
    { name: "expirationTime",  ...timestampItem },
    { name: "relayFee",        ...relayFeeItem  },
    { name: "quoterSignature", ...signatureItem },
  ],
] as const;

export const onChainUsdcVariant = [
  "onChainUsdc", [
    { name: "maxRelayFeeUsdc",       ...usdcItem   },
    { name: "takeRelayFeeFromInput", ...boolItem() },
  ],
] as const;

export const onChainGasVariant = <const L extends ConstLayout>(layout: L) =>
  ["onChainGas", layout] as const;

const userQuoteVariants = <const K extends GasTokenKind, const L extends ConstLayout>(
  kind: K,
  onChainGasLayout: L,
) => [
  offChainVariant(offChainRelayFeeVariantItem(kind)),
  onChainUsdcVariant,
  onChainGasVariant(onChainGasLayout),
] as const;

export const userQuoteVariantItem = <const K extends GasTokenKind, const L extends ConstLayout>(
  kind: K,
  onChainGasLayout: L,
) => byteSwitchItem("type", enumSwitchVariants(userQuoteVariants(kind, onChainGasLayout)));

export type UserQuoteVariant<K extends GasTokenKind, L extends ConstLayout> =
  DeriveType<ReturnType<typeof userQuoteVariantItem<K, L>>>;

export const quoteParamsLayout = <N extends Network>(network: N) => [
  { name: "destinationDomain", ...supportedDomainItem(network) },
  { name: "corridor",          ...corridorItem                 },
  { name: "gasDropoff",        ...gasDropoffItem               },
] as const satisfies Layout;
export type QuoteParams<N extends Network> = DeriveType<ReturnType<typeof quoteParamsLayout<N>>>;

export const offChainQuoteLayout = <
  N extends Network,
  P extends Platform,
  K extends GasTokenKind,
>(network: N, platform: P, kind: K) => [
  { name: "sourceDomain",    ...cctprPlatformDomainItem(network, platform) },
  ...quoteParamsLayout(network),
  { name: "expirationTime",  ...timestampItem                              },
  { name: "relayFeeVariant", ...offChainRelayFeeVariantItem(kind)          },
] as const satisfies Layout;

export type OffChainQuote<N extends Network, P extends Platform, K extends GasTokenKind> =
  DeriveType<ReturnType<typeof offChainQuoteLayout<N, P, K>>>;
