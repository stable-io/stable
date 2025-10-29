// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { usdc } from "@stable-io/cctp-sdk-definitions";
import type { ValidationOptions } from "class-validator";
import { AmountBounds, IsAmount } from "./isAmount.validator";
import { Rationalish } from "@stable-io/amount";

export function IsUsdcAmount(
  options: AmountBounds = {},
  validationOptions?: ValidationOptions,
) {
  return IsAmount(
    {
      min: options.min,
      max: options.max,
      decimals: 6,
      createAmount: (value: Rationalish | string) => usdc(value),
      typeName: "USDC",
    },
    validationOptions,
  );
}
