// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { percentage } from "@stable-io/cctp-sdk-definitions";
import type { ValidationOptions } from "class-validator";
import { AmountBounds, IsAmount } from "./isAmount.validator";
import { Rationalish } from "@stable-io/amount";

export function IsPercentage(
  options: AmountBounds = {},
  validationOptions?: ValidationOptions,
) {
  return IsAmount(
    {
      min: options.min,
      max: options.max,
      decimals: 2,
      createAmount: (value: string | Rationalish) => percentage(value, "human"),
      typeName: "percentage",
    },
    validationOptions,
  );
}
