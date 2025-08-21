// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Amount } from "./amount.js";
import { Rational } from "./rational.js";
import { Conversion } from "./conversion.js";

const BTC = {
  name: "BTC",
  units: [
    { symbol: "satoshi", scale: 1n },
    { symbol: "BTC", scale: 100_000_000n },
  ] as const,
  human: "BTC",
  atomic: "satoshi",
} as const;

const USD = {
  name: "USD",
  units: [
    { symbol: "cent", scale: 1n },
    { symbol: "USD", scale: 100n },
  ] as const,
  human: "USD",
  atomic: "cent",
} as const;

describe("Amount", () => {
  describe("creation", () => {
    it("creates from number", () => {
      const amount = Amount.from(1, BTC);
      expect(amount).toBeTruthy();
    });

    it("creates from bigint", () => {
      const amount = Amount.from(1n, BTC);
      expect(amount).toBeTruthy();
    });

    it("creates from Rational", () => {
      const amount = Amount.from(Rational.from(1n, 2n), BTC);
      expect(amount).toBeTruthy();
    });

    it("creates from string", () => {
      const amount = Amount.from("1.50", BTC, "satoshi");
      expect(amount).toBeTruthy();
    });

    it("creates with specific unit", () => {
      const amount = Amount.from(1, BTC, "satoshi");
      expect(amount).toBeTruthy();
    });

    it("creates with ofKind", () => {
      const amount = Amount.ofKind(BTC)(1);
      expect(amount).toBeTruthy();
    });
  });

  describe("string representation", () => {
    it("default stringification", () => {
      const amount = Amount.from(1, BTC);
      expect(amount.toString()).toBe("1 BTC");
    });

    it("toJSON representation", () => {
      const amount = Amount.from(1, BTC);
      expect(amount.toJSON()).toBe("1 BTC");
    });

    it("stringification without human unit", () => {
      const satoshi = {
        name: "satoshi",
        units: [
          { symbol: "satoshi", scale: 1n },
        ],
        atomic: "satoshi",
      } as const;
      const amount = Amount.from(150_000_000n, satoshi, "satoshi");
      expect(amount.toString()).toBe("150000000 satoshi");
    });

    it("custom stringification", () => {
      const customBTC = {
        ...BTC,
        stringify: (value: Rational) => `${value.div(10**8).toFixed(8)} CUSTOM`,
      };
      const amount = Amount.from(1.5, customBTC);
      expect(amount.toString()).toBe("1.50000000 CUSTOM");
    });
  });

  describe("conversion", () => {
    it("converts to specific units", () => {
      const amount = Amount.from(1, BTC);
      expect(amount.toUnit("satoshi").unwrap()).toEqual([100_000_000n, 1n]);
      expect(amount.toUnit("BTC").unwrap()).toEqual([1n, 1n]);
    });

    it("converts to atomic", () => {
      const amount = Amount.from(1, BTC);
      expect(amount.toUnit("atomic")).toEqual(100_000_000n);
    });

    it("converts to human", () => {
      const amount = Amount.from(100_000_000n, BTC, "satoshi");
      expect(amount.toUnit("human").unwrap()).toEqual([1n, 1n]);
    });

    it("converts between kinds", () => {
      const btcToUsd = Conversion.from(Rational.from(50_000n, 1n), USD, BTC);
      const amount = Amount.from(1n, BTC);
      const converted = amount.convert(btcToUsd);
      expect(converted.toUnit("human").unwrap()).toEqual([50_000n, 1n]);
    });

    it("throws on kind mismatch during conversion", () => {
      const btcToUsd = Conversion.from(Rational.from(50_000n, 1n), USD, BTC);
      const amount = Amount.from(1n, USD);
      expect(() => amount.convert(btcToUsd as any)).toThrow("Kind mismatch: USD vs BTC");
    });

    it("floors to specific unit", () => {
      const amount = Amount.from(1.7, BTC);
      const floored = amount.floorTo("BTC");
      expect(floored.toUnit("BTC")).toEqual(Rational.from(1));
    });

    it("ceils to specific unit", () => {
      const amount = Amount.from(1.3, BTC);
      const ceiled = amount.ceilTo("BTC");
      expect(ceiled.toUnit("BTC")).toEqual(Rational.from(2));
    });

    it("floors to atomic unit", () => {
      const amount = Amount.from(Rational.from(150_000_000n, 1n).add(Rational.from(7n, 10n)), BTC, "satoshi");
      const floored = amount.floorTo("satoshi");
      expect(floored.toUnit("atomic")).toEqual(150_000_000n);
    });

    it("ceils to atomic unit", () => {
      const amount = Amount.from(Rational.from(150_000_000n, 1n).add(Rational.from(3n, 10n)), BTC, "satoshi");
      const ceiled = amount.ceilTo("atomic");
      expect(ceiled.toUnit("atomic")).toEqual(150_000_001n);
    });

    it("floors to human unit", () => {
      const amount = Amount.from(1.7, USD);
      const floored = amount.floorTo("human");
      expect(floored.toUnit("human")).toEqual(Rational.from(1));
    });

    it("ceils to human unit", () => {
      const amount = Amount.from(1.3, USD);
      const ceiled = amount.ceilTo("human");
      expect(ceiled.toUnit("human")).toEqual(Rational.from(2));
    });
  });

  describe("standardUnit", () => {
    it("returns the first unit", () => {
      const amount = Amount.from(1, BTC);
      expect(amount.standardUnit()).toEqual({ symbol: "satoshi", scale: 1n });
    });
  });

  describe("arithmetic", () => {
    it("addition", () => {
      const a1 = Amount.from(1, BTC);
      const a2 = Amount.from(2, BTC);
      const sum = a1.add(a2);
      expect(sum.toUnit("BTC").unwrap()).toEqual([3n, 1n]);
    });

    it("subtraction", () => {
      const a1 = Amount.from(2, BTC);
      const a2 = Amount.from(1, BTC);
      const diff = a1.sub(a2);
      expect(diff.toUnit("BTC").unwrap()).toEqual([1n, 1n]);
    });

    it("multiplication", () => {
      const amount = Amount.from(2, BTC);
      const product = amount.mul(2);
      expect(product.toUnit("BTC").unwrap()).toEqual([4n, 1n]);
    });

    it("division", () => {
      const amount = Amount.from(4, BTC);
      const quotient = amount.div(2);
      expect(quotient.toUnit("BTC").unwrap()).toEqual([2n, 1n]);
    });

    it("throws on kind mismatch", () => {
      const btc = Amount.from(1, BTC);
      const usd = Amount.from(1, USD);
      // @ts-expect-error | Disallowed by type system but possible at runtime
      expect(() => btc.add(usd)).toThrow("Kind mismatch: BTC vs USD");
    });
  });

  describe("comparison", () => {
    it("equality", () => {
      const a1 = Amount.from(1, BTC);
      const a2 = Amount.from(1, BTC);
      const a3 = Amount.from(2, BTC);
      expect(a1.eq(a2)).toBe(true);
      expect(a1.eq(a3)).toBe(false);
    });

    it("inequality", () => {
      const a1 = Amount.from(1, BTC);
      const a2 = Amount.from(2, BTC);
      expect(a1.ne(a2)).toBe(true);
    });

    it("greater than", () => {
      const a1 = Amount.from(2, BTC);
      const a2 = Amount.from(1, BTC);
      expect(a1.gt(a2)).toBe(true);
      expect(a2.gt(a1)).toBe(false);
    });

    it("less than", () => {
      const a1 = Amount.from(1, BTC);
      const a2 = Amount.from(2, BTC);
      expect(a1.lt(a2)).toBe(true);
      expect(a2.lt(a1)).toBe(false);
    });

    it("greater than or equal", () => {
      const a1 = Amount.from(2, BTC);
      const a2 = Amount.from(1, BTC);
      const a3 = Amount.from(2, BTC);
      expect(a1.ge(a2)).toBe(true);
      expect(a2.ge(a1)).toBe(false);
      expect(a1.ge(a3)).toBe(true);
    });

    it("less than or equal", () => {
      const a1 = Amount.from(1, BTC);
      const a2 = Amount.from(2, BTC);
      const a3 = Amount.from(1, BTC);
      expect(a1.le(a2)).toBe(true);
      expect(a2.le(a1)).toBe(false);
      expect(a1.le(a3)).toBe(true);
    });
  });
});
