// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/* eslint-disable unicorn/no-null */
// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import {
  bigintReplacer,
  bigintReviver,
  serializeBigints,
  deserializeBigints,
  stringifyWithBigints,
  parseWithBigints,
  type SerializedBigint,
} from "./serialization.js";

describe("BigInt Serialization", () => {
  const testData = {
    userBalance: 1000000000000000000n,
    nonce: 42n,
    deadline: 1703980800n,
    metadata: {
      chainId: 1n,
      amounts: [100n, 200n, 300n],
    },
    regularString: "hello",
    regularNumber: 123,
    regularBoolean: true,
  };

  describe("bigintReplacer", () => {
    it("should convert BigInt to SerializedBigint", () => {
      const result = bigintReplacer("test", 123n);
      expect(result).toEqual({
        $type: "bigint",
        value: "123",
      } satisfies SerializedBigint);
    });

    it("should leave non-BigInt values unchanged", () => {
      expect(bigintReplacer("test", "string")).toBe("string");
      expect(bigintReplacer("test", 123)).toBe(123);
      expect(bigintReplacer("test", true)).toBe(true);
      expect(bigintReplacer("test", null)).toBe(null);
    });
  });

  describe("bigintReviver", () => {
    it("should convert SerializedBigint back to BigInt", () => {
      const serialized: SerializedBigint = {
        $type: "bigint",
        value: "123",
      };
      const result = bigintReviver("test", serialized);
      expect(result).toBe(123n);
      expect(typeof result).toBe("bigint");
    });

    it("should leave non-SerializedBigint values unchanged", () => {
      expect(bigintReviver("test", "string")).toBe("string");
      expect(bigintReviver("test", 123)).toBe(123);
      expect(bigintReviver("test", true)).toBe(true);
      expect(bigintReviver("test", null)).toBe(null);
    });

    it("should not convert objects that look like SerializedBigint but aren't", () => {
      const notSerialized = { $type: "other", value: "123" };
      expect(bigintReviver("test", notSerialized)).toBe(notSerialized);
    });
  });

  describe("serializeBigints and deserializeBigints", () => {
    it("should serialize and deserialize complex objects with BigInts", () => {
      const serialized = serializeBigints(testData);
      const deserialized = deserializeBigints<typeof testData>(serialized);

      expect(deserialized).toEqual(testData);
      expect(typeof deserialized.userBalance).toBe("bigint");
      expect(typeof deserialized.nonce).toBe("bigint");
      expect(typeof deserialized.deadline).toBe("bigint");
      expect(typeof deserialized.metadata.chainId).toBe("bigint");
      expect(deserialized.metadata.amounts.every(amount => typeof amount === "bigint")).toBe(true);
    });

    it("should preserve non-BigInt values", () => {
      const serialized = serializeBigints(testData);
      const deserialized = deserializeBigints<typeof testData>(serialized);

      expect(deserialized.regularString).toBe("hello");
      expect(deserialized.regularNumber).toBe(123);
      expect(deserialized.regularBoolean).toBe(true);
    });

    it("should handle empty objects", () => {
      const empty = {};
      const serialized = serializeBigints(empty);
      const deserialized = deserializeBigints(serialized);
      expect(deserialized).toEqual({});
    });

    it("should handle arrays with BigInts", () => {
      const arrayData = { values: [1n, 2n, 3n] };
      const serialized = serializeBigints(arrayData);
      const deserialized = deserializeBigints<typeof arrayData>(serialized);

      expect(deserialized.values).toEqual([1n, 2n, 3n]);
      expect(deserialized.values.every(v => typeof v === "bigint")).toBe(true);
    });
  });

  describe("stringifyWithBigints and parseWithBigints", () => {
    it("should stringify and parse objects with BigInts", () => {
      const jsonString = stringifyWithBigints(testData);
      const parsed = parseWithBigints<typeof testData>(jsonString);

      expect(parsed).toEqual(testData);
      expect(typeof parsed.userBalance).toBe("bigint");
      expect(typeof parsed.nonce).toBe("bigint");
      expect(typeof parsed.deadline).toBe("bigint");
    });

    it("should produce valid JSON", () => {
      const jsonString = stringifyWithBigints(testData);
      expect(() => JSON.parse(jsonString)).not.toThrow();
    });

    it("should handle primitive BigInt values", () => {
      const bigintValue = 123456789n;
      const jsonString = stringifyWithBigints(bigintValue);
      const parsed = parseWithBigints<bigint>(jsonString);

      expect(parsed).toBe(bigintValue);
      expect(typeof parsed).toBe("bigint");
    });
  });

  describe("round-trip compatibility", () => {
    it("should maintain data integrity through multiple serialization cycles", () => {
      let current = testData;

      // Multiple round trips
      for (let i = 0; i < 3; i++) {
        const serialized = serializeBigints(current);
        current = deserializeBigints<typeof testData>(serialized);
      }

      expect(current).toEqual(testData);
    });

    it("should work with JSON.stringify/parse using replacer/reviver", () => {
      const jsonString = JSON.stringify(testData, bigintReplacer);
      const parsed = JSON.parse(jsonString, bigintReviver);

      expect(parsed).toEqual(testData);
    });
  });
});
