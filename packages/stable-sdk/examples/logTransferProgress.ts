// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { ViemSigner } from "../src/signer/viemSigner.js";
import { privateKeyToAccount } from "viem/accounts";
import StableSDK from "../src/index.js";
import { Address } from "viem";
import dotenv from "dotenv";
import { bigintReplacer } from "../src/utils";

dotenv.config();
const privateKey = process.env.EVM_PRIVATE_KEY as Address;
const account = privateKeyToAccount(privateKey);

const sender = account.address;
const recipient = account.address;

const rpcUrls = {};

const sdk = new StableSDK({
  network: "Testnet",
  signer: new ViemSigner(account),
  rpcUrls,
});

const intent = {
  sourceChain: "Ethereum" as const,
  targetChain: "Optimism" as const,
  amount: "0.01",
  sender,
  recipient,
  gasDropoffDesired: 0n,
};

const routes = await sdk.findRoutes(intent, { paymentToken: "usdc" });

console.info(`Transfers from ${intent.sourceChain} to ${intent.targetChain}.`);
console.info(`Sender: ${sender}`);
console.info(`Recipient: ${recipient}`);

const selectedRoutes = [routes.all[3]];

for (const route of selectedRoutes) {
  const hasBalance = await sdk.checkHasEnoughFunds(route);
  if (!hasBalance) {
    console.info(`${route.intent.sender} doesn't have enough balance to pay for the transfer`);
    continue;
  }

  route.progress.on("step-completed", (event) => {
    console.log(`Received step-completed event "${event.name}". Data: ${stringify(event.data)}`);
  });

  /**
   * Alternatively you can listen to a specific event
   */
  // route.progress.on("permit-signed", (e) => {
  //   console.log("permit signed!")
  // });

  // route.progress.on("approval-sent", (e) => {
  //   console.log("approval sent!");
  // });

  // route.progress.on("transfer-sent", (e) => {
  //   console.log("transfer sent!");
  // });

  // route.progress.on("transfer-confirmed", (e) => {
  //   console.log("transfer included!");
  // });

  // route.progress.on("hop-redeemed", () => {
  //   console.log("hop redeemed!");
  // });

  // route.progress.on("hop-confirmed", () => {
  //   console.log("hop confirmed");
  // });

  // route.progress.on("transfer-redeemed", (e) => {
  //   console.log("transfer redeemed!");
  // });

  /**
   * Alternatively you can listen to all events with a single handler.
   * It will only emit all events that don't have a listener for that specific event
   * (like the examples the above);
   */

  
  console.info(`Executing route ${route.corridor} with -${route.steps.length}- steps`);
  await sdk.executeRoute(route);

  console.info("Done.");
}

function stringify(obj: any) {
  return JSON.stringify(obj, bigintReplacer);
}
