// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Transform, type TransformFnParams } from "class-transformer";

/**
 * Transform decorator that converts null values to undefined.
 */
export function NullToUndefined(): PropertyDecorator {
  return Transform(({ value }: TransformFnParams) =>
    value === null ? undefined : value,
  );
}
