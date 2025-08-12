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