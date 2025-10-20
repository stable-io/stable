// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import dotenv from "dotenv";
import { privateKeyToAccount } from "viem/accounts";

import StableSDK from "../index.js";
import { Address } from "viem";
import { ViemSigner } from "../signer/viemSigner.js";
import { bigintReplacer } from "../utils.js";

dotenv.config();
const privateKey = process.env.EVM_PRIVATE_KEY as Address;
const account = privateKeyToAccount(privateKey);
const someone = "0x504328390Af8bf1Fd52E9281d1325Fa5cc5a54F4";
const someoneElse = "0x31537D1DBB3dBA2F34e0913Dd157F74A4fCb9595";

const stringify = (value: unknown) => JSON.stringify(value, bigintReplacer, 2);

const rpcUrls = {
  Ethereum: "https://ethereum-sepolia.rpc.subquery.network/public",
};

const sdk = new StableSDK({
  network: "Testnet",
  signer: {
    Evm: new ViemSigner(account),
  },
  rpcUrls,
});

const intent = {
  sourceChain: "Ethereum" as const,
  targetChain: "Polygon" as const,
  amount: "1",
  sender: someone,
  recipient: someoneElse,
};

const routes = await sdk.findRoutes(intent);

console.info("Routes:", stringify(routes.all));
