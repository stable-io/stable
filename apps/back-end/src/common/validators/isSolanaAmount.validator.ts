import { Sol, sol } from "@stable-io/cctp-sdk-definitions";
import type { ValidationOptions } from "class-validator";
import { AmountBounds, AmountProperties, IsAmount } from "./isAmount.validator";
import { Rationalish } from "@stable-io/amount";

export const solanaAmountProperties: AmountProperties<Sol> = {
  decimals: 9,
  createAmount: (value: Rationalish | string) => sol(value),
  typeName: "Solana",
};

export function IsSolanaAmount(
  options: AmountBounds = {},
  validationOptions?: ValidationOptions,
) {
  return IsAmount(
    {
      ...options,
      ...solanaAmountProperties,
    },
    validationOptions,
  );
}
