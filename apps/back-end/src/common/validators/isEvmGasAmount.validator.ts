// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { EvmGasToken } from "@stable-io/cctp-sdk-definitions";
import { evmGasToken } from "@stable-io/cctp-sdk-definitions";
import type { ValidationOptions } from "class-validator";
import { AmountBounds, AmountProperties, IsAmount } from "./isAmount.validator";
import { Rationalish } from "@stable-io/amount";

export const evmGasTokenAmountProperties: AmountProperties<EvmGasToken> = {
  decimals: 18,
  createAmount: (value: Rationalish | string) => evmGasToken(value),
  typeName: "gas token",
};

export function IsEvmGasTokenAmount(
  options: AmountBounds = {},
  validationOptions?: ValidationOptions,
) {
  return IsAmount(
    {
      ...options,
      ...evmGasTokenAmountProperties,
    },
    validationOptions,
  );
}
