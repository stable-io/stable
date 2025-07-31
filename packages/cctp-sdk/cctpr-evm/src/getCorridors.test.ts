// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/require-await */
import type { EvmClient, ContractTx } from "@stable-io/cctp-sdk-evm";
import { avax, EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { getCorridors } from "./getCorridors.js";

describe("getCorridors", () => {
  const sourceDomain = "Ethereum";
  const destinationDomain = "Avalanche";
  const allowance = 99999999997.99998;
  const minimumFee = 1;
  let mockClient: EvmClient<"Testnet", keyof EvmDomains>;

  beforeEach(() => {
    jest.spyOn(globalThis, "fetch").mockImplementation(
      async (input: string | URL | Request): Promise<Response> => {
        if (/\/allowance$/iu.test(input.toString())) {
          return new Response(JSON.stringify({
            allowance,
            lastUpdated: "2025-04-17T14:02:30.411Z",
          }));
        }
        if (/\/fees\//iu.test(input.toString())) {
          return new Response(JSON.stringify({
            minimumFee,
          }));
        }
        throw new Error(`No mock for fetch input: ${input.toString()}`);
      },
    );
    mockClient = {
      network: "Testnet" as const,
      domain: "Ethereum" as const,
      ethCall: jest.fn().mockImplementation(
        async (tx: ContractTx) => {
          const serializedLength2Quotes = 18;
          const serializedLength4Quotes = 32;
          const data = tx.data.length === serializedLength2Quotes
            // [0.334538, 0.000107569911611929]
            ? "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABRrKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABh1ZJewhk"
            : tx.data.length === serializedLength4Quotes
            // [0.334538, 0.000107569911611929, 0.308127, 0.000099077550168882]
            ? "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABRrKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABh1ZJewhkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASznwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWhxKLtsy"
            : undefined;
          if (data === undefined) {
            throw new Error("Invalid number of quotes");
          }
          return new Uint8Array(Buffer.from(data, "base64"));
        },
      ),
    } as unknown as EvmClient<"Testnet", keyof EvmDomains>;
  });

  it("throws when source and destination domains are the same", async () => {
    await expect(
      getCorridors()(mockClient, sourceDomain),
    ).rejects.toThrow("Values are not distinct: Ethereum, Ethereum");
  });

  it("includes fast burn allowance in response", async () => {
    const result = await getCorridors()(mockClient, destinationDomain);
    expect(result.fastBurnAllowance.toUnit("USDC").toNumber()).toBe(allowance);
  });

  // Currently v2 supports the same chains than v1 on testnet (and soon mainnet)
  it.skip("returns v1 corridor for when source domain is not v2-supported", async () => {
    (mockClient as any).domain = "Polygon";
    const result = await getCorridors()(mockClient, "Ethereum");
    expect(new Set(result.stats.map(s => s.corridor))).toEqual(new Set(["v1"]));
  });

  it(
    "returns v1 and v2Direct corridors when both source and destination domains are v2-supported",
    async () => {
      const v2Destination = "Avalanche";
      const result = await getCorridors()(mockClient, v2Destination);
      expect(new Set(result.stats.map(s => s.corridor))).toEqual(new Set(["v1", "v2Direct"]));
    },
  );

  it("returns v1 corridor for when source domain is v2-supported but fast", async () => {
    (mockClient as any).domain = "Avalanche";
    const v2Destination = "Ethereum";
    const result = await getCorridors()(mockClient, v2Destination);
    expect(new Set(result.stats.map(s => s.corridor))).toEqual(new Set(["v1"]));
  });

  // Currently there's no chains where v2 is supported and v1 is not
  it.skip("returns v1 and avaxHop corridors when source domain is v2-supported and destination is not", async () => {
    const nonV2Destination = "Polygon";
    const result = await getCorridors()(mockClient, nonV2Destination);
    expect(new Set(result.stats.map(s => s.corridor))).toEqual(new Set(["v1", "avaxHop"]));
  });

  describe("corridor costs", () => {
    it.each([
      {
        corridor: "v1",
        sourceDomain: "Polygon" as const,
        destinationDomain: "Ethereum" as const,
        expectedUsdcCost: 0.334538,
        expectedGasCost: 0.000107569911611929,
        hasFastCost: false,
      },
      {
        corridor: "v2Direct",
        sourceDomain: "Ethereum" as const,
        destinationDomain: "Avalanche" as const,
        expectedUsdcCost: 0.308127,
        expectedGasCost: 0.000099077550168882,
        hasFastCost: true,
      },
      // Currently no route uses avax hop
      // {
      //   corridor: "avaxHop",
      //   sourceDomain: "Ethereum" as const,
      //   destinationDomain: "Polygon" as const,
      //   expectedUsdcCost: 0.308127,
      //   expectedGasCost: 0.000099077550168882,
      //   hasFastCost: true,
      // },
    ])("calculates correct costs for $corridor", async ({ sourceDomain, destinationDomain, corridor, expectedUsdcCost, expectedGasCost, hasFastCost }) => {
      (mockClient as any).domain = sourceDomain;
      const result = await getCorridors()(mockClient, destinationDomain);
      const stats = result.stats.find(s => s.corridor === corridor)!;

      expect(stats.cost.relay[0].toUnit("USDC").toNumber()).toBe(expectedUsdcCost);
      expect(stats.cost.relay[1].toUnit("human").toNumber()).toBe(expectedGasCost);

      if (hasFastCost) {
        expect(stats.cost.fast?.toUnit("bp").toNumber()).toBe(minimumFee);
      } else {
        expect(stats.cost.fast).toBeUndefined();
      }
    });
  });

  describe("corridor cost structure", () => {
    it.each([
      {
        corridor: "v1",
        sourceDomain: "Polygon" as const,
        destinationDomain: "Ethereum" as const,
        hasFastCost: false,
      },
      {
        corridor: "v2Direct",
        sourceDomain: "Ethereum" as const,
        destinationDomain: "Avalanche" as const,
        hasFastCost: true,
      },
      // Currently no chains combination uses avax hop on testnet (and soon mainnet)
      // {
      //   corridor: "avaxHop",
      //   sourceDomain: "Ethereum" as const,
      //   destinationDomain: "Polygon" as const,
      //   hasFastCost: true,
      // },
    ])("has correct cost structure for $corridor", async ({ sourceDomain, destinationDomain, corridor, hasFastCost }) => {
      (mockClient as any).domain = sourceDomain;
      const result = await getCorridors()(mockClient, destinationDomain);
      const stats = result.stats.find(s => s.corridor === corridor)!;

      expect(stats.cost.relay).toHaveLength(2);

      if (hasFastCost) {
        expect(stats.cost.fast).toBeDefined();
      } else {
        expect(stats.cost.fast).toBeUndefined();
      }
    });
  });

  it("handles optional gasDropoff parameter", async () => {
    const gasDropoff = avax(0.001);
    const resultWithoutGasDropoff = await getCorridors()(mockClient, destinationDomain);
    const resultWithGasDropoff = await getCorridors()(mockClient, destinationDomain, gasDropoff);
    expect(resultWithGasDropoff.stats).toHaveLength(resultWithoutGasDropoff.stats.length);
    // TODO: Verify that the gasDropoff is used in the cost calculation
  });
});
