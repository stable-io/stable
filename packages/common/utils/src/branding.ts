// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// See https://egghead.io/blog/using-branded-types-in-typescript
declare const __brand: unique symbol;
type Branded<B> = { [__brand]: B };
export type Brand<T, B> = T & Branded<B>;

export type IsBranded<T> = T extends Brand<T, unknown> ? true : false;
export type PreserveBrand<T, R> =
  T extends Brand<infer U, infer B>
  ? U extends R
    ? Brand<R, B>
    : never
  : R;

export type Unbrand<T> = T extends Brand<infer U, unknown> ? U : T;

export type SameBrand<T, U> = T extends Brand<unknown, infer B1>
  ? U extends Brand<unknown, B1>
    ? true
    : false
  : false;
