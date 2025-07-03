import { encoding } from "@stable-io/utils";
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationOptions,
} from "class-validator";
import { parseSignature, isHex } from "viem";
import type { ParsedSignature } from "../types";

@ValidatorConstraint({ name: "isSignature", async: false })
export class IsSignatureConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    if (!isHex(value)) return false;

    try {
      const signature = parseSignature(value);
      if (signature.v === undefined) return false;

      const parsedSignature: ParsedSignature = {
        v: signature.v,
        r: encoding.hex.decode(signature.r),
        s: encoding.hex.decode(signature.s),
      };

      // Transform the value
      (args.object as any)[args.property] = parsedSignature;
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage({ property }: ValidationArguments) {
    return `${property} must be a valid hex signature`;
  }
}

export function IsSignature(validationOptions?: ValidationOptions) {
  return function (obj: object, propertyName: string) {
    registerDecorator({
      target: obj.constructor,
      propertyName: propertyName,
      options: validationOptions || {},
      constraints: [],
      validator: IsSignatureConstraint,
    });
  };
}
