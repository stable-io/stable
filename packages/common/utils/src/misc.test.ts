// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/* eslint-disable @typescript-eslint/no-unsafe-call */

import type { Text } from "./misc.js";
import { definedOrThrow, isUint8Array, throws, pollUntil } from "./misc.js";

describe("throws", () => {
  it("should return false when no error is thrown", () => {
    expect(throws(() => {})).toBe(false);
  });

  it("should return true when an error is thrown", () => {
    expect(
      throws(() => {
        throw new Error("Test error");
      }),
    ).toBe(true);
  });
});

describe("definedOrThrow", () => {
  it("should return the value if defined", () => {
    // eslint-disable-next-line unicorn/no-null
    expect(definedOrThrow(null, "Value is undefined" as Text)).toBe(null);
    expect(definedOrThrow(0, "Value is undefined" as Text)).toBe(0);
    expect(definedOrThrow(false, "Value is undefined" as Text)).toBe(false);
    expect(definedOrThrow("", "Value is undefined" as Text)).toBe("");
  });

  it("should throw an error if the value is undefined", () => {
    expect(() => definedOrThrow(undefined, "Value is undefined" as Text)).toThrow(
      "Value is undefined",
    );
  });
});

describe("isUint8Array", () => {
  it("should return true for Uint8Array", () => {
    expect(isUint8Array(new Uint8Array([1, 2, 3]))).toBe(true);
    expect(isUint8Array(Buffer.from([]))).toBe(true);
  });

  it("should return false for non-Uint8Array values", () => {
    expect(isUint8Array([])).toBe(false);
    expect(isUint8Array({})).toBe(false);
    expect(isUint8Array("string")).toBe(false);
    expect(isUint8Array(123)).toBe(false);
    // eslint-disable-next-line unicorn/no-null
    expect(isUint8Array(null)).toBe(false);
    // eslint-disable-next-line unicorn/no-useless-undefined
    expect(isUint8Array(undefined)).toBe(false);
  });
});

describe("pollUntil", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("success cases", () => {
    it("should return immediately when predicate is true on first attempt", async () => {
      const operation = jest.fn().mockResolvedValue("success");
      const predicate = jest.fn((result: any) => result === "success");

      const promise = (pollUntil as any)(operation, predicate, {});
      const result = await promise;

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
      expect(predicate).toHaveBeenCalledTimes(1);
      expect(predicate).toHaveBeenCalledWith("success");
    });

    it("should poll until predicate returns true", async () => {
      const operation = jest.fn()
        .mockResolvedValueOnce("attempt1")
        .mockResolvedValueOnce("attempt2")
        .mockResolvedValueOnce("success");

      const predicate = jest.fn((result: any) => result === "success");

      const promise = (pollUntil as any)(operation, predicate, { baseDelayMs: 10 });

      // Let the first attempt complete
      await jest.runOnlyPendingTimersAsync();

      // Advance through delays and let promises resolve
      jest.advanceTimersByTime(10);
      await jest.runOnlyPendingTimersAsync();

      jest.advanceTimersByTime(15); // 10 * 1.5
      await jest.runOnlyPendingTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
      expect(predicate).toHaveBeenCalledTimes(3);
    });

    it("should work with type predicate overload", async () => {
      interface SuccessResult {
        status: "success";
        data: string;
      }

      interface PendingResult {
        status: "pending";
      }

      type Result = SuccessResult | PendingResult;

      const operation = jest.fn()
        .mockResolvedValueOnce({ status: "pending" } as PendingResult)
        .mockResolvedValueOnce({ status: "success", data: "test" } as SuccessResult);

      const isSuccess = (result: Result): result is SuccessResult =>
        result.status === "success";

      const promise = pollUntil(operation, isSuccess, { baseDelayMs: 10 });

      // Let first attempt complete, then advance timer and let second attempt complete
      await jest.runOnlyPendingTimersAsync();
      jest.advanceTimersByTime(10);
      await jest.runOnlyPendingTimersAsync();

      const result = await promise;

      expect(result.status).toBe("success");
      expect(result.data).toBe("test");
    });

    it("should respect custom config options", async () => {
      const operation = jest.fn()
        .mockResolvedValueOnce("fail")
        .mockResolvedValueOnce("success");

      const predicate = jest.fn((result: any) => result === "success");

      const config = {
        baseDelayMs: 20,
        maxDelayMs: 50,
        backoffMultiplier: 2,
        timeoutMs: 1000,
      };

      const promise = (pollUntil as any)(operation, predicate, config);

      // Let first attempt complete, then advance by custom delay
      await jest.runOnlyPendingTimersAsync();
      jest.advanceTimersByTime(20);
      await jest.runOnlyPendingTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should cap delay at maxDelayMs", async () => {
      const operation = jest.fn()
        .mockResolvedValueOnce("fail1")
        .mockResolvedValueOnce("fail2")
        .mockResolvedValueOnce("success");

      const predicate = jest.fn((result: any) => result === "success");

      const config = {
        baseDelayMs: 10,
        maxDelayMs: 15,
        backoffMultiplier: 3,
        timeoutMs: 1000,
      };

      const promise = (pollUntil as any)(operation, predicate, config);

      // First attempt
      await jest.runOnlyPendingTimersAsync();
      // First delay: 10ms
      jest.advanceTimersByTime(10);
      await jest.runOnlyPendingTimersAsync();

      // Second delay: 10 * 3 = 30ms, capped at 15ms
      jest.advanceTimersByTime(15);
      await jest.runOnlyPendingTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe("error cases", () => {
    it("should throw timeout error when condition is never met", async () => {
      const operation = jest.fn().mockResolvedValue("never_success");
      const predicate = jest.fn((result: any) => result === "success");

      // Mock Date.now to work with fake timers
      const startTime = 1000;
      const mockDate = jest.spyOn(globalThis.Date, "now");
      mockDate.mockReturnValueOnce(startTime); // Start time
      mockDate.mockReturnValueOnce(startTime + 50); // First check - still within timeout
      mockDate.mockReturnValueOnce(startTime + 150); // Second check - past timeout

      const promise = (pollUntil as any)(operation, predicate, { timeoutMs: 100, baseDelayMs: 10 });

      // Advance timers to trigger the timeout logic
      jest.advanceTimersByTime(150);
      await Promise.all([
        jest.runOnlyPendingTimersAsync(),
        expect(promise).rejects.toThrow("Polling timeout after 100ms"),
      ]);
    });

    it("should propagate operation errors", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Operation failed"));
      const predicate = jest.fn((result: any) => true);

      const promise = (pollUntil as any)(operation, predicate, {});

      await expect(promise).rejects.toThrow("Operation failed");
      expect(predicate).not.toHaveBeenCalled();
    });

    it("should propagate predicate errors", async () => {
      const operation = jest.fn().mockResolvedValue("test");
      const predicate = jest.fn((result: any) => {
        throw new Error("Predicate failed");
      });

      const promise = (pollUntil as any)(operation, predicate, {});

      await expect(promise).rejects.toThrow("Predicate failed");
    });
  });

  describe("edge cases", () => {
    it("should handle zero timeout", async () => {
      const operation = jest.fn().mockResolvedValue("test");
      const predicate = jest.fn((result: any) => false);

      // Mock Date.now to ensure time has passed
      const mockDate = jest.spyOn(globalThis.Date, "now");
      mockDate.mockReturnValueOnce(0); // Start time
      mockDate.mockReturnValueOnce(1); // Time check - 1ms passed > 0ms timeout

      const promise = (pollUntil as any)(operation, predicate, { timeoutMs: 0 });

      await expect(promise).rejects.toThrow("Polling timeout after 0ms");

      mockDate.mockRestore();
    });

    it("should handle very short timeout with immediate success", async () => {
      const operation = jest.fn().mockResolvedValue("success");
      const predicate = jest.fn((result: any) => result === "success");

      const promise = (pollUntil as any)(operation, predicate, { timeoutMs: 1 });
      const result = await promise;

      expect(result).toBe("success");
    });

    it("should handle zero base delay", async () => {
      const operation = jest.fn()
        .mockResolvedValueOnce("fail")
        .mockResolvedValueOnce("success");

      const predicate = jest.fn((result: any) => result === "success");

      const promise = (pollUntil as any)(operation, predicate, { baseDelayMs: 0 });

      // With zero delay, second attempt should happen immediately
      await jest.runOnlyPendingTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
    });

    it("should use default config values when not provided", async () => {
      const operation = jest.fn()
        .mockResolvedValueOnce("fail")
        .mockResolvedValueOnce("success");

      const predicate = jest.fn((result: any) => result === "success");

      const promise = (pollUntil as any)(operation, predicate, {});

      // First attempt
      await jest.runOnlyPendingTimersAsync();
      // Default baseDelayMs is 500
      jest.advanceTimersByTime(500);
      await jest.runOnlyPendingTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
    });

    it("should use default config when no config parameter provided", async () => {
      const operation = jest.fn()
        .mockResolvedValueOnce("fail")
        .mockResolvedValueOnce("success");

      const predicate = jest.fn((result: any) => result === "success");

      // Call with only 2 parameters to hit the default parameter branch
      const promise = (pollUntil as any)(operation, predicate);

      // First attempt
      await jest.runOnlyPendingTimersAsync();
      // Default baseDelayMs is 500
      jest.advanceTimersByTime(500);
      await jest.runOnlyPendingTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
    });

    it("should handle backoff multiplier of 1 (no backoff)", async () => {
      const operation = jest.fn()
        .mockResolvedValueOnce("fail1")
        .mockResolvedValueOnce("fail2")
        .mockResolvedValueOnce("success");

      const predicate = jest.fn((result: any) => result === "success");

      const config = {
        baseDelayMs: 10,
        backoffMultiplier: 1,
      };

      const promise = (pollUntil as any)(operation, predicate, config);

      // First attempt
      await jest.runOnlyPendingTimersAsync();
      // All delays should be 10ms
      jest.advanceTimersByTime(10);
      await jest.runOnlyPendingTimersAsync();
      jest.advanceTimersByTime(10);
      await jest.runOnlyPendingTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
    });
  });
});
