import { usdc } from "@stable-io/cctp-sdk-definitions";
import type { ValidationOptions } from "class-validator";
import { AmountBounds, IsAmount } from "./isAmount.validator";
import { Rationalish } from "@stable-io/amount";

export function IsUsdcAmount(
  options: AmountBounds = {},
  validationOptions?: ValidationOptions,
) {
  return IsAmount(
    {
      min: options.min,
      max: options.max,
      decimals: 6,
      createAmount: (value: Rationalish | string) => usdc(value),
      typeName: "USDC",
    },
    validationOptions,
  );
}
