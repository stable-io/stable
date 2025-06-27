// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

export interface SerializedBigint {
  $type: "bigint";
  value: string;
}

const isSerializedBigint = (value: unknown): value is SerializedBigint =>
  typeof value === "object" &&
  value !== null &&
  "$type" in value &&
  "value" in value &&
  (value as any).$type === "bigint" &&
  typeof (value as any).value === "string";

/**
 * JSON.stringify replacer that converts BigInt values to structured format
 */
export const bigintReplacer = (key: string, value: unknown): unknown =>
  typeof value === "bigint"
    ? ({
        $type: "bigint",
        value: value.toString(10),
      } satisfies SerializedBigint)
    : value;

/**
 * JSON.parse reviver that converts structured BigInt format back to native BigInt
 */
export const bigintReviver = (key: string, value: unknown): unknown =>
  isSerializedBigint(value) ? BigInt(value.value) : value;

/**
 * Convert an object with BigInt values to a JSON-safe object
 */
export const serializeBigints = (
  obj: Record<string, unknown>,
): Record<string, unknown> => JSON.parse(JSON.stringify(obj, bigintReplacer));

/**
 * Parse a JSON-safe object back to an object with native BigInt values
 */
export const deserializeBigints = <T>(obj: Record<string, unknown>): T =>
  JSON.parse(JSON.stringify(obj), bigintReviver) as T;

/**
 * Stringify an object with BigInt values to JSON string
 */
export const stringifyWithBigints = (obj: unknown): string =>
  JSON.stringify(obj, bigintReplacer);

/**
 * Parse a JSON string back to an object with native BigInt values
 */
export const parseWithBigints = <T>(jsonString: string): T =>
  JSON.parse(jsonString, bigintReviver) as T;
