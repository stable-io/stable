// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

export const bigintReplacer = (_: unknown, value: unknown) => typeof value === "bigint" ? value.toString() : value;

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
