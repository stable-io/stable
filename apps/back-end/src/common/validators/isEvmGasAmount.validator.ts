import type { EvmGasToken } from "@stable-io/cctp-sdk-definitions";
import { evmGasToken } from "@stable-io/cctp-sdk-definitions";
import type { ValidationOptions } from "class-validator";
import { IsAmount } from "./isAmount.validator";

interface EvmGasTokenAmountOptions {
  min?: EvmGasToken;
  max?: EvmGasToken;
}

export function IsEvmGasTokenAmount(
  options: EvmGasTokenAmountOptions = {},
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
