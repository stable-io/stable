// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { base16 as b16, base64 as b64, base58 as b58, bech32 as be32 } from "@scure/base";
import type { Size } from "./misc.js";
import type { PreserveBrand } from "./branding.js";

export const stripPrefix = (prefix: string, str: string): string =>
  str.startsWith(prefix) ? str.slice(prefix.length) : str;

const isHexRegex = /^(?:0x)?[0-9a-fA-F]+$/;
export const hex = {
  isValid: (input: string): boolean =>
    isHexRegex.test(input),

  decode: (input: string): Uint8Array =>
    b16.decode(stripPrefix("0x", input).toUpperCase()),

  encode: ((input: string | Uint8Array, prefix: boolean = false): string => {
    input = typeof input === "string" ? bytes.encode(input) : input;
    const result = b16.encode(input).toLowerCase();
    return prefix ? `0x${result}` : result;
  }) as {
    (input: string | Uint8Array, prefix: true): `0x${string}`;
    (input: string | Uint8Array, prefix?: boolean): string;
  },
};

export const bech32 = {
  decode: /* istanbul ignore next */ (input: string): Uint8Array =>
    be32.decodeToBytes(input).bytes,

  //no encoding for bech32 for now since there's currently no need and it doesn't fit
  // the mold of the other encoding functions
};

export const base58 = {
  decode: b58.decode,

  encode: (input: string | Uint8Array): string =>
    b58.encode(typeof input === "string" ? bytes.encode(input) : input),
};

// eslint-disable-next-line regexp/use-ignore-case
const isB64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
export const base64 = {
  isValid: (input: string): boolean => isB64Regex.test(input),

  decode: b64.decode,

  encode: (input: string | Uint8Array): string =>
    b64.encode(typeof input === "string" ? bytes.encode(input) : input),
};

export const bignum = {
  decode: (input: string | Uint8Array, emptyIsZero: boolean = false): bigint => {
    if (typeof input !== "string")
      input = hex.encode(input, true);
    if (input === "" || input === "0x") {
      if (emptyIsZero)
        return 0n;
      else
        throw new Error("Invalid input");
    }
    return BigInt(input);
  },

  encode: ((input: bigint, prefix: boolean = false) =>
    bignum.toString(input, prefix)) as {
      (input: bigint, prefix: true): `0x${string}`;
      (input: bigint, prefix?: boolean): string;
    },

  toString: ((input: bigint, prefix: boolean = false): string => {
    let str = input.toString(16);
    str = str.length % 2 === 1 ? (str = "0" + str) : str;
    if (prefix) return "0x" + str;
    return str;
  }) as {
    (input: bigint, prefix: true): `0x${string}`;
    (input: bigint, prefix?: boolean): string;
  },

  toBytes: (input: bigint | number, length?: Size): Uint8Array => {
    if (typeof input === "number")
      input = bignum.toBigInt(input);
    const b = hex.decode(bignum.toString(input));
    if (length === undefined)
      return b;
    if (length < b.length)
      throw new Error(`Can't fit ${input} into ${length} bytes.`);
    return bytes.zpad(b, length);
  },

  toNumber: (input: bigint): number => {
    if (input < BigInt(Number.MIN_SAFE_INTEGER) || BigInt(Number.MAX_SAFE_INTEGER) < input)
      throw new Error(`Invalid cast: ${input} out of safe integer range`);

    return Number(input);
  },

  toBigInt: (input: number): bigint => {
    if (!Number.isSafeInteger(input))
      throw new Error(`Invalid cast: ${input} out of safe integer range`);

    return BigInt(input);
  },
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const bytes = {
  encode: (value: string): Uint8Array =>
    encoder.encode(value),

  decode: (value: Uint8Array): string =>
    decoder.decode(value),

  equals: (lhs: Uint8Array, rhs: Uint8Array): boolean =>
    lhs.length === rhs.length && lhs.every((v, i) => v === rhs[i]),

  zpad: <U extends Uint8Array>(
    arr: U,
    length: Size,
    padStart: boolean = true,
  ): PreserveBrand<U, Uint8Array> => {
    if (length === arr.length)
      return arr as Uint8Array as PreserveBrand<U, Uint8Array>;

    if (length < arr.length)
      throw new Error(`Padded length must be >= input length`);

    const result = new Uint8Array(length) as PreserveBrand<U, Uint8Array>;
    result.set(arr, padStart ? length - arr.length : 0);
    return result;
  },

  concat: <U extends Uint8Array>(...args: U[]): PreserveBrand<U, Uint8Array> => {
    const length = args.reduce((acc, curr) => acc + curr.length, 0);
    const result = new Uint8Array(length) as PreserveBrand<U, Uint8Array>;
    let offset = 0;
    for (const arg of args) {
      result.set(arg, offset);
      offset += arg.length;
    }
    return result;
  },
};
