import type { Usdc } from "@stable-io/cctp-sdk-definitions";
import { usdc } from "@stable-io/cctp-sdk-definitions";
import type { ValidationOptions } from "class-validator";
import { IsAmount } from "./isAmount.validator";

interface UsdcAmountOptions {
  min?: Usdc;
  max?: Usdc;
}

export function IsUsdcAmount(
  options: UsdcAmountOptions = {},
  validationOptions?: ValidationOptions,
) {
  return IsAmount(
    {
      min: options.min,
      max: options.max,
      decimals: 6,
      createAmount: (value: string) => usdc(value),
      typeName: "USDC",
    },
    validationOptions,
  );
}
