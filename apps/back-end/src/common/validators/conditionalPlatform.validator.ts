import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationOptions,
} from "class-validator";
import { platformOf } from "@stable-io/cctp-sdk-definitions";

export type DomainField = {
  // The domain field name from the object
  domainField: string;
};

export type ValidatorWithConstraints<T> = {
  validator: ValidatorConstraintInterface;
  constraints?: T;
};

type PlatformValidationOptions<T, U> = DomainField & {
  // Map from platform to validator instance
  validators: Record<string, ValidatorWithConstraints<T>>;
  generalConstraints?: U;
};

@ValidatorConstraint({ name: "conditionalPlatformValidation", async: false })
export class ConditionalPlatformValidationConstraint<T, U>
  implements ValidatorConstraintInterface
{
  static getPlatform<T, U>(
    options: PlatformValidationOptions<T, U>,
    object: Record<string, any>,
  ): string | undefined {
    const domain = object[options.domainField];
    if (!domain) return undefined;
    return platformOf(domain);
  }

  validate(value: unknown, args: ValidationArguments) {
    const [options] = args.constraints as [PlatformValidationOptions<T, U>];
    const object = args.object as Record<string, any>;
    const platform = ConditionalPlatformValidationConstraint.getPlatform(
      options,
      object,
    );
    if (!platform) {
      return false;
    }
    const validator = options.validators[platform];
    if (!validator) {
      return false;
    }
    return validator.validator.validate(value, {
      ...args,
      constraints: [
        { ...options.generalConstraints, ...validator.constraints },
      ],
    });
  }

  defaultMessage(args: ValidationArguments) {
    const [options] = args.constraints as [PlatformValidationOptions<T, U>];
    const object = args.object as Record<string, any>;

    const platform = ConditionalPlatformValidationConstraint.getPlatform(
      options,
      object,
    );
    if (!platform) {
      return `Couldn't derive platform`;
    }
    // Get the error message for this platform
    const validator = options.validators[platform];
    if (!validator) {
      return `Platform ${platform} not supported`;
    }
    return validator.validator.defaultMessage?.({
      ...args,
      constraints: [
        { ...options.generalConstraints, ...validator.constraints },
      ],
    }) ?? `Invalid value for platform ${platform}`;
  }
}

/**
 * Validates a value based on the platform determined by the domain field in the object.
 * Uses the platformOf mapping from the SDK to determine the platform from the domain.
 * Takes a map of platform names to validator instances.
 * Optionally accepts a hardcoded platform that takes priority over domain-based detection.
 * Either domainField or platform must be provided.
 */
export function ConditionalPlatformValidation<T, U>(
  options: PlatformValidationOptions<T, U>,
  validationOptions?: ValidationOptions,
) {
  return function (obj: object, propertyName: string) {
    registerDecorator({
      target: obj.constructor,
      propertyName: propertyName,
      options: validationOptions || {},
      constraints: [options],
      validator: ConditionalPlatformValidationConstraint<T, U>,
    });
  };
}
