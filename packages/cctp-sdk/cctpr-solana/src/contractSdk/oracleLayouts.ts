// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { DeriveType, ProperLayout } from "binary-layout";
import { calcStaticSize, optionItem } from "binary-layout";
import type { KindWithHuman } from "@stable-io/amount";
import {
  amountItem,
  conversionItem,
  paddingItem,
  linearTransform,
  Sol,
  EvmGasToken,
  Sui,
  Gas,
  ComputeUnit,
  Byte,
  Percentage,
  wormholeChainItem,
} from "@stable-io/cctp-sdk-definitions";
import type { Network } from "@stable-io/cctp-sdk-definitions";
import { usdcItem } from "@stable-io/cctp-sdk-cctpr-definitions";
import { accountLayout, littleEndian,solanaAddressItem } from "@stable-io/cctp-sdk-solana";
import { foreignDomains } from "./constants.js";

export const chainItem = <N extends Network>(network: N) =>
  wormholeChainItem(network, foreignDomains(network));

export const configLayout = accountLayout("Config", littleEndian([
  { name: "owner",        ...solanaAddressItem             },
  { name: "pendingOwner", ...optionItem(solanaAddressItem) },
  { name: "solPrice",     ...conversionItem(usdcItem, Sol) },
]));

const platformPriceSpace = 16;
const platformPriceLayout = <const L extends ProperLayout>(layout: L) => littleEndian([
  ...layout,
  { name: "reserved", ...paddingItem(platformPriceSpace - calcStaticSize(layout)!) }
]);

const mweiAmount = amountItem(4, EvmGasToken, linearTransform("to->from", 10n**6n));
const evmPricesLayout = platformPriceLayout([
  { name: "gasPrice",       ...conversionItem(mweiAmount, Gas ) },
  { name: "pricePerTxByte", ...conversionItem(mweiAmount, Byte) },
]);
export type EvmPrices = DeriveType<typeof evmPricesLayout>;

const mistAmount = amountItem(4, Sui);
const suiPricesLayout = platformPriceLayout([
  { name: "computeUnitPrice", ...conversionItem(mistAmount, ComputeUnit) },
  { name: "bytePrice",        ...conversionItem(mistAmount, Byte)        },
  { name: "rebateRatio",      ...amountItem(1, Percentage, "%")          },
]);
export type SuiPrices = DeriveType<typeof suiPricesLayout>;

export const priceStateLayoutTemplate = <
  N extends Network,
  const L extends ProperLayout,
  const K extends KindWithHuman,
>(network: N, layout: L, kind: K) => accountLayout("PricesState", [
  ...littleEndian([
    { name: "oracleChain",   ...chainItem(network) },
    { name: "gasTokenPrice", ...conversionItem(usdcItem, kind) },
  ]),
  ...layout,
]);

export const priceStateLayout = <N extends Network>(network: N) => ({
  Evm: priceStateLayoutTemplate(network, evmPricesLayout, EvmGasToken),
  Sui: priceStateLayoutTemplate(network, suiPricesLayout, Sui),
} as const);
export type PriceState<N extends Network, P extends keyof ReturnType<typeof priceStateLayout<N>>> =
  DeriveType<ReturnType<typeof priceStateLayout<N>>[P]>;
