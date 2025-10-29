// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { ConditionalPlatformValidation } from "./conditionalPlatform.validator";
import { IsEvmAddressConstraint, IsSolanaAddressConstraint } from "./index";
import type { ValidationOptions } from "class-validator";

export function IsPlatformAddress(
  domainField: string,
  validationOptions?: ValidationOptions,
) {
  return ConditionalPlatformValidation(
    {
      domainField,
      validators: {
        Evm: {
          validator: new IsEvmAddressConstraint(),
        },
        Solana: {
          validator: new IsSolanaAddressConstraint(),
        },
      },
    },
    validationOptions,
  );
}
