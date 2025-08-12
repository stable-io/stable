import { Transform, type TransformFnParams } from "class-transformer";

/**
 * Transform decorator that converts null values to undefined.
 */
export function NullToUndefined(): PropertyDecorator {
  return Transform(({ value }: TransformFnParams) =>
    value === null ? undefined : value,
  );
}
