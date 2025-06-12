import type { Amount, Kind } from "@stable-io/amount";
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationOptions,
} from "class-validator";

interface AmountOptions<T extends Amount<Kind>> {
  min?: T;
  max?: T;
  decimals: number;
  createAmount: (value: string) => T;
  typeName: string;
}

@ValidatorConstraint({ name: "isAmount", async: false })
export class IsAmountConstraint<T extends Amount<Kind>>
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments) {
    const [options] = args.constraints as [AmountOptions<T>];

    if (typeof value !== "string") return false;

    const regex = new RegExp(`^\\d+(?:\\.\\d{1,${options.decimals}})?$`);
    if (!regex.test(value)) return false;

    try {
      const amount = options.createAmount(value);

      if (options.min && amount.lt(options.min)) return false;
      if (options.max && amount.gt(options.max)) return false;

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
