import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationOptions,
} from "class-validator";

@ValidatorConstraint({ name: "isEvmAddress", async: false })
export class IsEvmAddressConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    if (typeof value !== "string") return false;

    try {
      if (!EvmAddress.isValidAddress(value)) return false;

      const evmAddress = new EvmAddress(value);

      // Transform the value
      (args.object as any)[args.property] = evmAddress;
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage() {
    return "Address must be a valid Ethereum address";
  }
}

export function IsEvmAddress(validationOptions?: ValidationOptions) {
  return function (obj: object, propertyName: string) {
    registerDecorator({
      target: obj.constructor,
      propertyName: propertyName,
      options: validationOptions || {},
      constraints: [],
      validator: IsEvmAddressConstraint,
    });
  };
}
