// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { KindWithAtomic } from "@stable-io/amount";
import { Amount } from "@stable-io/amount";
import { EvmAddress } from "./address.js";
import type { EvmClient } from "./platform.js";
import {
  composeApproveTx,
  dateToUnixTimestamp,
  getTokenAllowance,
  getTokenBalance,
} from "./utils.js";

describe("utils", () => {
  const token = new EvmAddress("0x0000000000000000000000000000000000000001");
  const owner = new EvmAddress("0x0000000000000000000000000000000000000002");
  const spender = new EvmAddress("0x0000000000000000000000000000000000000003");
  const kind = {
    name: "TestToken",
    units: [{ symbol: "atom", scale: 1n }, { symbol: "TEST", scale: 100n }],
    human: "TEST",
    atomic: "atom",
  } as const satisfies KindWithAtomic;

  describe("getTokenBalance", () => {
    it("should return token balance", async () => {
      const mockClient = {
        ethCall: jest.fn().mockResolvedValue(
          Uint8Array.from(Buffer.from(
            "0000000000000000000000000000000000000000000000000000000000000064",
            "hex",
          )),
        ),
      } as unknown as EvmClient;

      const balance = await getTokenBalance(mockClient, token, owner, kind);
      expect(balance.toUnit("atomic")).toBe(100n);
      expect(mockClient.ethCall).toHaveBeenCalledWith({
        to: token,
        data: expect.any(Uint8Array),
      });
    });
  });

  describe("getTokenAllowance", () => {
    it("should return allowance", async () => {
      const mockClient = {
        ethCall: jest.fn().mockResolvedValue(
          Uint8Array.from(Buffer.from(
            "0000000000000000000000000000000000000000000000000000000000000064",
            "hex",
          )),
        ),
      } as unknown as EvmClient;

      const allowance = await getTokenAllowance(mockClient, token, owner, spender, kind);
      expect(allowance.toUnit("atomic")).toBe(100n);
      expect(mockClient.ethCall).toHaveBeenCalledWith({
        to: token,
        data: expect.any(Uint8Array),
      });
    });
  });

  describe("composeApproveTx", () => {
    it("should create approve transaction", () => {
      const amount = Amount.from(100n, kind, "atomic");
      const tx = composeApproveTx(token, owner, spender, amount);

      expect(tx).toEqual({
        from: owner,
        to: token,
        data: expect.any(Uint8Array),
      });
    });
  });

  describe("dateToUnixTimestamp", () => {
    it("should convert date to correct unix timestamp", () => {
      const date = new Date("2024-01-01T00:00:00Z");
      expect(dateToUnixTimestamp(date)).toBe(1704067200n);
    });

    it("should throw error for dates before unix epoch", () => {
      const date = new Date("1969-12-31T23:59:59Z");
      expect(() => dateToUnixTimestamp(date)).toThrow(/date is before unix epoch/iu);
    });
  });
});
