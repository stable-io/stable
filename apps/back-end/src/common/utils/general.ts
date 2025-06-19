import { instanceToPlain as ctInstanceToPlain } from "class-transformer";
import type { PlainDto } from "../types";

export function createAmountRegexPattern(decimals: number): string {
  return `^\\d+(?:\\.\\d{1,${decimals}})?$`;
}

export const AMOUNT_PATTERNS = {
  USDC: createAmountRegexPattern(6),
  EVM_GAS_TOKEN: createAmountRegexPattern(18),
} as const;

export const ADDRESS_PATTERNS = {
  EVM: "^0x[a-fA-F0-9]{40}$",
};

export const instanceToPlain = <T>(obj: T): PlainDto<T> =>
  ctInstanceToPlain(obj) as PlainDto<T>;
