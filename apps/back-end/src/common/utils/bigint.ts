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
 * Convert an object with BigInt values to a JSON-safe object for JWT payload
 */
export const prepareJwtPayload = (
  obj: Record<string, unknown>,
): Record<string, unknown> => JSON.parse(JSON.stringify(obj, bigintReplacer));

/**
 * Parse a JWT payload back to an object with native BigInt values
 */
export const parseJwtPayload = <T>(obj: Record<string, unknown>): T =>
  JSON.parse(JSON.stringify(obj), bigintReviver) as T;
