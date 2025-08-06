import type { EvmGasToken } from "@stable-io/cctp-sdk-definitions";
import { evmGasToken } from "@stable-io/cctp-sdk-definitions";
import type { ValidationOptions } from "class-validator";
import { AmountBounds, AmountProperties, IsAmount } from "./isAmount.validator";
import { Rationalish } from "@stable-io/amount";

export const evmGasTokenAmountProperties: AmountProperties<EvmGasToken> = {
  decimals: 18,
  createAmount: (value: Rationalish | string) => evmGasToken(value),
  typeName: "gas token",
}

export function IsEvmGasTokenAmount(
  options: AmountBounds = {},
  validationOptions?: ValidationOptions,
) {
  return IsAmount(
    {
      ...options,
      ...evmGasTokenAmountProperties,
    },
    validationOptions,
  );
}
