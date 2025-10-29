// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { SolanaAddress } from "@stable-io/cctp-sdk-solana";
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationOptions,
} from "class-validator";

@ValidatorConstraint({ name: "isSolanaAddress", async: false })
export class IsSolanaAddressConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    if (typeof value !== "string") return false;
    try {
      if (!SolanaAddress.isValidAddress(value)) return false;
      const solanaAddress = new SolanaAddress(value);
      (args.object as any)[args.property] = solanaAddress;
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage() {
    return "Address must be a valid Solana address";
  }
}

export function IsSolanaAddress(validationOptions?: ValidationOptions) {
  return function (obj: object, propertyName: string) {
    registerDecorator({
      target: obj.constructor,
      propertyName: propertyName,
      options: validationOptions || {},
      constraints: [],
      validator: IsSolanaAddressConstraint,
    });
  };
}
