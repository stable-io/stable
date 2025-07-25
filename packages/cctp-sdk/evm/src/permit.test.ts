// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/* eslint-disable @typescript-eslint/require-await */
import { Amount, KindWithAtomic } from "@stable-io/amount";
import { EvmAddress } from "./address.js";
import { EvmClient } from "./client.js";
import { composePermitMsg } from "./permit.js";

describe("permit", () => {
  const token = new EvmAddress("0x0000000000000000000000000000000000000001");
  const owner = new EvmAddress("0x0000000000000000000000000000000000000002");
  const spender = new EvmAddress("0x0000000000000000000000000000000000000003");
  const kind = {
    name: "TestToken",
    units: [{ symbol: "atom", scale: 1n }, { symbol: "TEST", scale: 100n }],
    human: "TEST",
    atomic: "atom",
  } as const satisfies KindWithAtomic;

  describe.skip("composePermitMsg", () => {
    const mockClient = {
      network: "Testnet",
      domain: "Ethereum",
      ethCall: jest.fn().mockImplementation(async ({ data }) => {
        if (data[0] === 0x06) { // name()
          return Uint8Array.from(Buffer.from(
            "0000000000000000000000000000000000000000000000000000000000000020" + // offset
            "0000000000000000000000000000000000000000000000000000000000000008" + // length
            "54657374546f6b656e0000000000000000000000000000000000000000000000", // "TestToken"
            "hex",
          ));
        }
        if (data[0] === 0x36) { // DOMAIN_SEPARATOR()
          return Uint8Array.from(Buffer.from(
            "0000000000000000000000000000000000000000000000000000000000000020" + // offset
            "0000000000000000000000000000000000000000000000000000000000000020" + // length
            "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", // hash
            "hex",
          ));
        }
        if (data[0] === 0x7E) { // nonces()
          return Uint8Array.from(Buffer.from(
            "0000000000000000000000000000000000000000000000000000000000000001", // nonce
            "hex",
          ));
        }
        throw new Error("Unexpected function call");
      }),
    } as unknown as EvmClient<"Testnet">;

    it("should create permit message", async () => {
      const value = Amount.from(100n, kind, "atomic");
      const deadline = new Date("2024-01-01T00:00:00Z");

      const composeMsg = composePermitMsg("Testnet");
      const permit = await composeMsg(mockClient, token, owner, spender, value, deadline);

      expect(permit.domain).toEqual({
        name: "TestToken",
        version: expect.any(String),
        chainId: 1n,
        verifyingContract: token.unwrap(),
      });
      expect(permit.message).toEqual({
        owner: owner.unwrap(),
        spender: spender.unwrap(),
        value: 100n,
        nonce: 1n,
        deadline: 1704067200n,
      });
    });

    it("should handle infinity deadline", async () => {
      const value = Amount.from(100n, kind, "atomic");
      const composeMsg = composePermitMsg("Testnet");
      const permit = await composeMsg(mockClient, token, owner, spender, value, "infinity");

      expect(permit.message.deadline).toBe(2n ** 256n - 1n);
    });
  });
});
