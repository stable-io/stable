import type { Percentage } from "@stable-io/cctp-sdk-definitions";
import { percentage } from "@stable-io/cctp-sdk-definitions";
import type { ValidationOptions } from "class-validator";
import { IsAmount } from "./isAmount.validator";

interface PercentageOptions {
  min?: Percentage;
  max?: Percentage;
}

export function IsPercentage(
  options: PercentageOptions = {},
  validationOptions?: ValidationOptions,
) {
  return IsAmount(
    {
      min: options.min,
      max: options.max,
      decimals: 2,
      createAmount: (value: string) => percentage(value, "human"),
      typeName: "percentage",
    },
    validationOptions,
  );
}
