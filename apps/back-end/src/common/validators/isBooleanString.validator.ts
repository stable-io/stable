// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationOptions,
} from "class-validator";

// Reference: https://github.com/typestack/class-transformer/issues/550
// class-transformer transforms strings to booleans via truthiness, so "false" becomes true
// This validator properly handles string-to-boolean conversion for query parameters
@ValidatorConstraint({ name: "isBooleanString", async: false })
export class IsBooleanStringConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    if (typeof value === "boolean") return true;
    if (typeof value !== "string") return false;
    if (value !== "true" && value !== "false") return false;

    const booleanValue = value === "true";
    (args.object as any)[args.property] = booleanValue;
    return true;
  }

  defaultMessage({ property }: ValidationArguments) {
    return `${property} must be a boolean string ('true' or 'false')`;
  }
}

export function IsBooleanString(validationOptions?: ValidationOptions) {
  return function (obj: object, propertyName: string) {
    registerDecorator({
      target: obj.constructor,
      propertyName: propertyName,
      options: validationOptions || {},
      constraints: [],
      validator: IsBooleanStringConstraint,
    });
  };
}
