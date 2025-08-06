import { percentage } from "@stable-io/cctp-sdk-definitions";
import type { ValidationOptions } from "class-validator";
import { AmountBounds, IsAmount } from "./isAmount.validator";
import { Rationalish } from "@stable-io/amount";

export function IsPercentage(
  options: AmountBounds = {},
  validationOptions?: ValidationOptions,
) {
  return IsAmount(
    {
      min: options.min,
      max: options.max,
      decimals: 2,
      createAmount: (value: string | Rationalish) => percentage(value, "human"),
      typeName: "percentage",
    },
    validationOptions,
  );
}
