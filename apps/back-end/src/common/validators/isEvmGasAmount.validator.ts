import type { EvmGasToken } from "@stable-io/cctp-sdk-definitions";
import { evmGasToken } from "@stable-io/cctp-sdk-definitions";
import type { ValidationOptions } from "class-validator";
import { IsAmount } from "./isAmount.validator";

interface EvmGasAmountOptions {
  min?: EvmGasToken;
  max?: EvmGasToken;
}

export function IsEvmGasAmount(
  options: EvmGasAmountOptions = {},
  validationOptions?: ValidationOptions,
) {
  return IsAmount(
    {
      min: options.min,
      max: options.max,
      decimals: 18,
      createAmount: (value: string) => evmGasToken(value),
      typeName: "gas token",
    },
    validationOptions,
  );
}
