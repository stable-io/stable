// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/require-await */
import { Network, registerPlatformClient, avax, EvmDomains } from "@stable-io/cctp-sdk-definitions";
import type { EvmClient, ContractTx } from "@stable-io/cctp-sdk-evm";
import { getRelayCosts } from "./getRelayCosts.js";
import { SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";
import { Url } from "@stable-io/utils";

describe("getRelayCosts", () => {
  const network = "Testnet";
  const sourceDomain = "Ethereum";
  const destinationDomain = "Avalanche";
  const allowance = 99999999997.99998;
  const minimumFee = 1;

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

    registerPlatformClient("Evm", (
      network: Network,
      domain: SupportedDomain<Network>,
      rpcUrl?: Url,
    ) => ({
      network,
      domain,
      ethCall: jest.fn().mockImplementation(
        async (tx: ContractTx) => {
          const serializedLength2Quotes = 18;
          const data = tx.data.length === serializedLength2Quotes
            // [0.334538, 0.000107569911611929]
            ? "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABRrKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABh1ZJewhk"
            : undefined;

          if (data === undefined) {
            throw new Error("Invalid number of quotes");
          }
          return new Uint8Array(Buffer.from(data, "base64"));
        },
      ),
    }) as unknown as EvmClient<"Testnet", keyof EvmDomains>);
  });

  it.each([
    {
      corridor: "v1" as const,
      sourceDomain: "Polygon" as const,
      destinationDomain: "Ethereum" as const,
      expectedUsdcCost: 0.334538,
      expectedGasCost: 0.000107569911611929,
    },
    {
      corridor: "v2Direct" as const,
      sourceDomain: "Ethereum" as const,
      destinationDomain: "Arbitrum" as const,
      expectedUsdcCost: 0.334538,
      expectedGasCost: 0.000107569911611929,
    },
    // Currently no route uses avax hop
    // {
    //   corridor: "avaxHop",
    //   sourceDomain: "Ethereum" as const,
    //   destinationDomain: "Polygon" as const,
    //   expectedUsdcCost: 0.308127,
    //   expectedGasCost: 0.000099077550168882,
    // },
  ])("calculates correct costs for $corridor", async ({ sourceDomain, destinationDomain, corridor, expectedUsdcCost, expectedGasCost }) => {
    const results = await getRelayCosts(network, sourceDomain, destinationDomain, [corridor]);
    const result = results[0]!;
    expect(result[0].toUnit("USDC").toNumber()).toBe(expectedUsdcCost);
    expect(result[1].toUnit("human").toNumber()).toBe(expectedGasCost);
  });

  it("handles optional gasDropoff parameter", async () => {
    const gasDropoff = avax(0.001);
    const resultWithoutGasDropoff = await getRelayCosts(network, sourceDomain, destinationDomain, ["v1"]);
    const resultWithGasDropoff = await getRelayCosts(network, sourceDomain, destinationDomain, ["v1"], gasDropoff);
    expect(resultWithGasDropoff).toHaveLength(resultWithoutGasDropoff.length);
    // TODO: Verify that the gasDropoff is used in the cost calculation
  });
});
