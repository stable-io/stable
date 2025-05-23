// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Url } from "@stable-io/utils";
import { $findRedeem } from "./findRedeem.js";
import { Domain } from "@stable-io/cctp-sdk-definitions";
import { viemChainOf } from "@stable-io/cctp-sdk-viem";

describe("$findRedeem", () => {
  let findRedeem: ReturnType<typeof $findRedeem>;

  beforeEach(() => {
    findRedeem = $findRedeem({
      getNetwork: () => "Testnet",
      getRpcUrl: (domain: Domain) => {
        const viemChain = viemChainOf["Testnet"][domain];
        return viemChain.rpcUrls.default.http[0] as Url;
      },
    });
  });

  it("Should be able to find the redeem of a v1 transfer", async () => {
    const v1result = await findRedeem(
      "Optimism",
      "0x5f883178dafb93717888186e14f744ee9690c109b75bae0580f413f5c352faf6",
      156006000n,
    );
    expect(v1result).toStrictEqual({
      transactionHash: "0xb3b8cc06c1e4342ba7ee0f9c1112e920697b43b4f5f10cbcc52ec84caa7923f1",
      destinationDomain: "Arbitrum",
    });
  }, 100000);

  it("Should be able to find the redeem of a v2 transfer", async () => {
    const v2result = await findRedeem(
      "Ethereum",
      "0x4ffcbe5f6d5d7fec99b5301356802a473e558333f10e79db87df8bc5640f0e3e",
      40858336n,
    );
    expect(v2result).toStrictEqual({
      transactionHash: "0xbf98c2b66e602bb3307a51533b2123088fc8dd8fd7eace59452c96958b72988f",
      destinationDomain: "Avalanche",
    });
  }, 100000);

  it("should be able to find the redeem of an avaxHop transfer", async () => {
    const avaxHopResult = await findRedeem(
      "Ethereum",
      "0x27a1ea24e83be2f5d83654d7d31f1af18dfebedc1702dc37fb99137d0aec1b19",
      27975457n,
      40765074n,
    );
    expect(avaxHopResult).toStrictEqual({
      transactionHash: "0xff1a8042b807f2a9a192784fc07cd1edcf9906d3c56a98601d58a9eaf9f22073",
      destinationDomain: "Optimism",
    });
  }, 100000);
});
