// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Layout, Item } from "binary-layout";
import type { Network } from "@stable-io/cctp-sdk-definitions";
import { uint256Item } from "@stable-io/cctp-sdk-definitions";
import { evmAddressItem, paddedSlotItem, abiEncodedBytesItem } from "@stable-io/cctp-sdk-evm";
import { feeAdjustmentTypes } from "@stable-io/cctp-sdk-cctpr-definitions";
import { feeAdjustmentsSlotItem } from "./feeAdjustments.js";
import { chainIdsSlotItem } from "./extraChainIds.js";

const isMainnetItem = <N extends Network>(network: N) => ({
  ...uint256Item, custom: network === "Mainnet" ? 1n : 0n, omit: true,
} as const);

const feeAdjustmentChunksPerTypeLayout = {
  binary: "array", length: feeAdjustmentTypes.length, layout: feeAdjustmentsSlotItem,
} as const satisfies Layout;

export const chainDataLayout = [
  { name: "extraChains",
    binary: "array",
    lengthSize: 1,
    layout: chainIdsSlotItem,
  },
  { name: "feeAdjustments",
    binary: "array",
    lengthSize: 1,
    layout: feeAdjustmentChunksPerTypeLayout,
  },
] as const satisfies Layout;

export const constructorLayout = <N extends Network>(network: N) => {
  const abiEncodedParams = [
    { name: "isMainnet",        ...isMainnetItem(network)         },
    { name: "owner",            ...paddedSlotItem(evmAddressItem) },
    { name: "feeAdjuster",      ...paddedSlotItem(evmAddressItem) },
    { name: "feeRecipient",     ...paddedSlotItem(evmAddressItem) },
    { name: "offChainQuoter",   ...paddedSlotItem(evmAddressItem) },
    { name: "usdc",             ...paddedSlotItem(evmAddressItem) },
    { name: "tokenMessengerV1", ...paddedSlotItem(evmAddressItem) },
    { name: "tokenMessengerV2", ...paddedSlotItem(evmAddressItem) },
    { name: "avaxRouter",       ...paddedSlotItem(evmAddressItem) },
    { name: "priceOracle",      ...paddedSlotItem(evmAddressItem) },
    { name: "permit2",          ...paddedSlotItem(evmAddressItem) },
  ] as const;

  return [
    ...abiEncodedParams,
    { name: "chainData",
      ...abiEncodedBytesItem({
        position: abiEncodedParams.length,
        layout: chainDataLayout,
      }),
    },
  ] as const;
};
