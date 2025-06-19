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
    if (typeof value !== "string") return false;
    if (value !== "true" && value !== "false") return false;

    const booleanValue = value === "true";
    (args.object as any)[args.property] = booleanValue;
    return true;
  }

  defaultMessage() {
    return "Value must be a boolean string ('true' or 'false')";
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
