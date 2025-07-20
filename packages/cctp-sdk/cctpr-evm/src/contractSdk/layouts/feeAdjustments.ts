// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Layout, DeriveType } from "binary-layout";
import type { RoArray } from "@stable-io/map-utils";
import { Rational } from "@stable-io/amount";
import { Usdc, amountItem, linearTransform } from "@stable-io/cctp-sdk-definitions";
import { paddedSlotItem } from "@stable-io/cctp-sdk-evm";

//negative values mean a discount on relay costs (but gas dropoff is never discounted)
const feeAdjustmentAbsoluteUsdcItem = {
  ...amountItem(2, Usdc, "human", linearTransform("from->to", 100)), //stored in cents
  binary: "int",
} as const satisfies Layout;

//100 means no discount and no risk premium on execution costs
const feeAdjustmentRelativePercentItem = { binary: "uint", size: 1 } as const satisfies Layout;

const feeAdjustmentLayout = [
  { name: "absoluteUsdc",    ...feeAdjustmentAbsoluteUsdcItem    },
  { name: "relativePercent", ...feeAdjustmentRelativePercentItem },
] as const satisfies Layout;
export type FeeAdjustment = DeriveType<typeof feeAdjustmentLayout>;

//We reverse the order because layout arrays have the opposite indexing order of uint256s that are
//  used as arrays in the contract:
// * layouts are indexed/serialized "left to right" i.e. MSB first, i.e. Aptos is index 0, while
//   Ethereum is index 9
// * uint256s are indexed "right to left" i.e. LSB first, i.e. Ethereum is stored in the least
//   significant bytes of the uint256 which corresponds to index 0
const reverseAdjustments = (fa: RoArray<FeeAdjustment>) => fa.toReversed();

export const feeAdjustmentsPerSlot = 10;
export const feeAdjustmentsSlotItem = {
  binary: "bytes",
  layout: paddedSlotItem({
    binary: "array",
    length: feeAdjustmentsPerSlot,
    layout: feeAdjustmentLayout,
  }),
  custom: { to: reverseAdjustments, from: reverseAdjustments },
} as const satisfies Layout;
