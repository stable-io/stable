// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Brand, IsBranded } from "./branding.js";

export type TODO = any;

/**
 * Extend this type to create an object-like interface which is expected to be overridden,
 * eg via a type declaration. An empty interface is equivalent to `any`, and allows values
 * which are not object-like such as numbers or strings. A `Record<PropertyKey, never>` prohibits
 * declaration merging. `object` itself cannot be extended directly, so we define this type alias.
 */
export type BaseObject = object;

export type Text = Brand<string, "Text">;
export type Url = Brand<string, "Url">;
export type Size = Brand<number, "Size">;

export interface BrandedSubArray<T extends Uint8Array> extends Uint8Array {
  subarray(
    ...params: Parameters<Uint8Array["subarray"]>
  ): T extends IsBranded<infer _> ? T : Uint8Array;
}

export const definedOrThrow = <const T>(value: T | undefined, errorMessage: Text) => {
  if (value === undefined)
    throw new Error(errorMessage);
  return value;
};

export function throws(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

//works across realms
export function isUint8Array(value: unknown): value is Uint8Array {
  return Object.prototype.toString.call(value) === "[object Uint8Array]";
}


export interface PollingConfig {
  readonly timeoutMs?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly backoffMultiplier?: number;
}

export async function pollUntil<T, R extends T>(
  operation: () => Promise<T>,
  predicate: (result: T) => result is R,
  config?: PollingConfig,
): Promise<R>;
export async function pollUntil<T>(
  operation: () => Promise<T>,
  predicate: (result: T) => boolean,
  config: PollingConfig = {},
): Promise<T> {
  const {
    timeoutMs = 90_000,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    backoffMultiplier = 1.5,
  } = config;

  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime <= timeoutMs) {
    const result = await operation();
    if (predicate(result)) {
      return result;
    }

    ++attempt;
    const delay = Math.min(
      baseDelayMs * Math.pow(backoffMultiplier, attempt - 1),
      maxDelayMs,
    );
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  throw new Error(`Polling timeout after ${timeoutMs}ms`);
}