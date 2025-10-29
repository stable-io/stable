// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { ConditionalPlatformValidation } from "./conditionalPlatform.validator";
import {
  AmountBounds,
  AmountProperties,
  IsAmountConstraint,
} from "./isAmount.validator";
import type { ValidationOptions } from "class-validator";
import { evmGasTokenAmountProperties } from "./isEvmGasAmount.validator";
import { Amount, Kind } from "@stable-io/amount";
import { solanaAmountProperties } from "./isSolanaAmount.validator";

/**
 * Validates an amount based on the platform determined by the domain field in the object.
 * Uses the platformOf mapping from the SDK to determine the platform from the domain.
 * Currently supports Evm and Solana platforms.
 * Optionally accepts a hardcoded platform that takes priority over domain-based detection.
 * Either domainField or platform must be provided.
 */
export function IsPlatformAmount(
  domainField: string,
  generalConstraints?: AmountBounds,
  validationOptions?: ValidationOptions,
) {
  return ConditionalPlatformValidation<
    AmountProperties<Amount<Kind>>,
    AmountBounds
  >(
    {
      domainField,
      generalConstraints,
      validators: {
        Evm: {
          validator: new IsAmountConstraint(),
          constraints: evmGasTokenAmountProperties,
        },
        Solana: {
          validator: new IsAmountConstraint(),
          constraints: solanaAmountProperties,
        },
      },
    },
    validationOptions,
  );
}
