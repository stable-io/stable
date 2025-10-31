import { instanceToPlain as ctInstanceToPlain } from "class-transformer";
import type { PlainDto, ParsedSignature } from "../types";

export function createAmountRegexPattern(...decimals: number[]): string {
  return `^(${decimals.map((d) => `\\d+(?:\\.\\d{1,${d}})?`).join("|")})$`;
}

export const AMOUNT_DECIMALS = {
  USDC: 6,
  EVM_GAS_TOKEN: 18,
  SOL: 9,
  PERCENTAGE: 2,
};

export const AMOUNT_PATTERNS = {
  USDC: createAmountRegexPattern(AMOUNT_DECIMALS.USDC),
  EVM_GAS_TOKEN: createAmountRegexPattern(AMOUNT_DECIMALS.EVM_GAS_TOKEN),
  SOL: createAmountRegexPattern(AMOUNT_DECIMALS.SOL),
  EVM_GAS_TOKEN_OR_SOL: createAmountRegexPattern(
    AMOUNT_DECIMALS.EVM_GAS_TOKEN,
    AMOUNT_DECIMALS.SOL,
  ),
  PERCENTAGE: createAmountRegexPattern(AMOUNT_DECIMALS.PERCENTAGE),
} as const;

export const instanceToPlain = <T>(obj: T): PlainDto<T> =>
  ctInstanceToPlain(obj) as PlainDto<T>;

export const serializeSignature = (signature: ParsedSignature): Uint8Array => {
  const result = new Uint8Array(65);
  result.set(signature.r, 0);
  result.set(signature.s, 32);
  result[64] = Number(signature.v);
  return result;
};
