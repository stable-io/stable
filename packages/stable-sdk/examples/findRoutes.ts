// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import dotenv from "dotenv";
import { privateKeyToAccount } from "viem/accounts";

import StableSDK from "../src/index.js";
import { Address } from "viem";
import { ViemSigner } from "../src/signer/viemSigner.js";
import { bigintReplacer } from "../src/utils.js";

dotenv.config();
const privateKey = process.env.EVM_PRIVATE_KEY as Address;
const account = privateKeyToAccount(privateKey);
const someone = "0x0000000000000000000000000000000000000000";
const someoneElse = "0x0000000000000000000000000000000000000001";

const stringify = (value: unknown) => JSON.stringify(value, bigintReplacer, 2);

const rpcUrls = {
  Ethereum: "https://ethereum-sepolia.rpc.subquery.network/public",
};

const sdk = new StableSDK({
  network: "Testnet",
  signer: new ViemSigner(account),
  rpcUrls,
});

const intent = {
  sourceChain: "Ethereum" as const,
  targetChain: "Polygon" as const,
  /**
   * @todo: why not just use usdc here?
   */
  amount: "1",
  /**
   * @todo:
   * sender and recipient should be optional for searching routes
   * (we can simply default to 0x000...).
   */
  sender: someone,
  recipient: someoneElse,
};

const routes = await sdk.findRoutes(intent, {
  paymentToken: "native",
  relayFeeMaxChangeMargin: 1.05, 
});

console.info("Routes:", stringify(routes.all));
