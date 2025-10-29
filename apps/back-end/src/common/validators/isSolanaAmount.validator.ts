// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Sol, sol } from "@stable-io/cctp-sdk-definitions";
import type { ValidationOptions } from "class-validator";
import { AmountBounds, AmountProperties, IsAmount } from "./isAmount.validator";
import { Rationalish } from "@stable-io/amount";

export const solanaAmountProperties: AmountProperties<Sol> = {
  decimals: 9,
  createAmount: (value: Rationalish | string) => sol(value),
  typeName: "Solana",
};

export function IsSolanaAmount(
  options: AmountBounds = {},
  validationOptions?: ValidationOptions,
) {
  return IsAmount(
    {
      ...options,
      ...solanaAmountProperties,
    },
    validationOptions,
  );
}
