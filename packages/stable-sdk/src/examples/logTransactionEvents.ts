// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { ViemSigner } from "../signer/viemSigner.js";
import { privateKeyToAccount } from "viem/accounts";
import StableSDK from "../index.js";
import { Address } from "viem";
import dotenv from "dotenv";

dotenv.config();
const privateKey = process.env.EVM_PRIVATE_KEY as Address;
const account = privateKeyToAccount(privateKey);

const sender = account.address;
const recipient = account.address;

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
  targetChain: "Optimism" as const,
  /**
   * @todo: why not just use usdc here?
   */
  amount: "0.01",
  /**
   * @todo:
   * sender and recipient should be optional for searching routes
   * (we can simply default to 0x000...).
   * @todo:
   * do we really need the sender if we get the wallet client?
   * after all, sender can"t be anyone but the signer :shrug:
   */
  sender,
  recipient,

  gasDropoffDesired: "0",
};

const routes = await sdk.findRoutes(intent);

console.info(`Transfers from ${intent.sourceChain} to ${intent.targetChain}.`);
console.info(`Sender: ${sender}`);
console.info(`Recipient: ${recipient}`);

const selectedRoutes = [routes.all[1]];

for (const route of selectedRoutes) {
  route.transactionListener.on("transaction-sent", (e) => {
    console.info("transaction sent!");
  });

  route.transactionListener.on("transaction-included", (e) => {
    console.info("transaction included!");
  });

  /**
   * Alternatively you can listen to all transaction events with a single handler:
   */
  route.transactionListener.on("*", (event) => {
    console.info(`Received transaction event "${event.name}". Data: ${JSON.stringify(event.data)}`);
  });

  console.info(`Executing route ${route.corridor} with -${route.steps.length}- steps`);
  await sdk.executeRoute(route);

  console.info("Done.");
}
