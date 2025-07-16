// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/require-await */
import type { EvmClient, ContractTx } from "@stable-io/cctp-sdk-evm";
import { avax, EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { getCorridorCosts } from "./getCorridorCosts.js";

describe("getCorridorCosts", () => {
  const network = "Testnet";
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
    // @todo: inject mock client
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
      getCorridorCosts(network, sourceDomain, sourceDomain, ["v1"]),
    ).rejects.toThrow("Values are not distinct: Ethereum, Ethereum");
  });

  it.each([
    {
      corridor: "v1" as const,
      sourceDomain: "Polygon" as const,
      destinationDomain: "Ethereum" as const,
      expectedUsdcCost: 0.334538,
      expectedGasCost: 0.000107569911611929,
      hasFastCost: false,
    },
    {
      corridor: "v2Direct" as const,
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
    const results = await getCorridorCosts(network, sourceDomain, destinationDomain, [corridor]);
    const result = results[0]!;
    expect(result.relay[0].toUnit("USDC").toNumber()).toBe(expectedUsdcCost);
    expect(result.relay[1].toUnit("human").toNumber()).toBe(expectedGasCost);

    if (hasFastCost) {
      expect(result.fast?.toUnit("bp").toNumber()).toBe(minimumFee);
    } else {
      expect(result.fast).toBeUndefined();
    }
  });

  it("handles optional gasDropoff parameter", async () => {
    const gasDropoff = avax(0.001);
    const resultWithoutGasDropoff = await getCorridorCosts(network, sourceDomain, destinationDomain, ["v1"]);
    const resultWithGasDropoff = await getCorridorCosts(network, sourceDomain, destinationDomain, ["v1"], gasDropoff);
    expect(resultWithGasDropoff).toHaveLength(resultWithoutGasDropoff.length);
    // TODO: Verify that the gasDropoff is used in the cost calculation
  });
});
