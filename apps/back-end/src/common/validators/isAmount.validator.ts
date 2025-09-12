import type { Amount, Kind, Rationalish } from "@stable-io/amount";
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationOptions,
} from "class-validator";
import { createAmountRegexPattern } from "../utils";

export interface AmountBounds {
  min?: Rationalish | string;
  max?: Rationalish | string;
}

export interface AmountProperties<T extends Amount<Kind>> {
  decimals: number;
  createAmount: (value: Rationalish | string) => T;
  typeName: string;
}

export interface AmountOptions<T extends Amount<Kind>>
  extends AmountBounds,
    AmountProperties<T> {}

@ValidatorConstraint({ name: "isAmount", async: false })
export class IsAmountConstraint<T extends Amount<Kind>>
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments) {
    const [options] = args.constraints as [AmountOptions<T>];

    if (typeof value !== "string") return false;

    const regex = new RegExp(createAmountRegexPattern(options.decimals));
    if (!regex.test(value)) return false;

    try {
      const amount = options.createAmount(value);

      if (options.min && amount.lt(options.createAmount(options.min)))
        return false;
      if (options.max && amount.gt(options.createAmount(options.max)))
        return false;

      // @note: This transforms the value
      (args.object as any)[args.property] = amount;
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    const [options] = args.constraints as [AmountOptions<T>];
    return `Amount must be a valid ${options.typeName} amount with up to ${
      options.decimals
    } decimal places${
      options.min ? ` (minimum: ${options.min.toString()})` : ""
    }${options.max ? ` (maximum: ${options.max.toString()})` : ""}`;
  }
}

export function IsAmount<T extends Amount<Kind>>(
  options: AmountOptions<T>,
  validationOptions?: ValidationOptions,
) {
  return function (obj: object, propertyName: string) {
    registerDecorator({
      target: obj.constructor,
      propertyName: propertyName,
      options: validationOptions || {},
      constraints: [options],
      validator: IsAmountConstraint<T>,
    });
  };
}
