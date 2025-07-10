// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import dotenv from "dotenv";
import { Address } from "viem";
import { eth, EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { ViemSigner } from "../src/signer/viemSigner.js";
import { privateKeyToAccount } from "viem/accounts";
import StableSDK, { Route } from "../src/index.js";
import { bigintReplacer } from "../src/utils";

dotenv.config();
const privateKey = process.env.EVM_PRIVATE_KEY as Address;
const account = privateKeyToAccount(privateKey);

const sender = account.address;
const recipient = account.address;

const rpcUrls = {
  Ethereum: "https://dimensional-solemn-scion.ethereum-sepolia.quiknode.pro/585eb5fde76eda6d2b9e4f6a150ec7bf4df12af1/",
};

const sdk = new StableSDK({
  network: "Testnet",
  signer: new ViemSigner(account),
  rpcUrls,
});

const intent = {
  sourceChain: "Ethereum" as const,
  targetChain: "Optimism" as const,
  amount: "0.1",
  sender,
  recipient,
  // To receive gas tokens on the target. Increases the cost of the transfer.
  // gasDropoffDesired: eth("0.0015").toUnit("atomic"),

  paymentToken: "usdc" as const, // defaults to usdc
};

const routes = await sdk.findRoutes(intent);

const selectedRoutes = [routes.cheapest];

for (const route of selectedRoutes) {
  const hasBalance = await sdk.checkHasEnoughFunds(route);
  if (!hasBalance) {
    console.info(`${route.intent.sender} doesn't have enough balance to pay for the transfer`);
    continue;
  }

  route.progress.on("step-completed", (e) => {
    console.info(`Step completed: ${e.name}.`);
    console.info(`Data: ${stringify(e.data)}\n`);
  });

  route.progress.on("error", (e) => {
    console.info(`Transfer failed on ${e.type.split("-")[0]} step.`);
  })

  route.transactionListener.on("*", (e) => {
    console.info(`Transaction Event: ${e.name}.`);
    // console.info(`Data: ${stringify(e.data)}\n`);
  });

  logRouteInfo(route);
  console.info("Executing route...");

  const {
    transactions,
    attestations,
    redeems,
    transferHash,
    redeemHash,
  } = await sdk.executeRoute(route);

  console.info(`Transfer Sent:`, getTestnetScannerTxUrl(route.intent.sourceChain, transferHash));
  console.info(`Transfer Redeemed:`, getTestnetScannerTxUrl(route.intent.targetChain, redeemHash));
}

function logRouteInfo(route: Route<any, any>) {
  console.info("");
  console.info(`Transferring from ${intent.sourceChain} to ${intent.targetChain}.`);
  console.info(`Sender: ${sender}`);
  console.info(`Recipient: ${recipient}`);
  console.info(`Routing through corridor: ${route.corridor}`);
  console.info(
    "Token Authorization To use:",
    route.requiresMessageSignature ? "Permit" : "Approval",
  );
  console.info("Signatures required", route.steps.length);
  // console.info(
  //   `Source TX cost + Relay Cost: $${route.estimatedTotalCost.toUnit("human").toString()}`,
  // );
  console.info(`Estimated Duration: ${route.estimatedDuration}s`);

  console.info("Fees to pay:");

  for (const fee of route.fees) {
    console.info(`    ${fee}`);
  }

  console.info("");
  console.info("");
}

function stringify(obj: any) {
  return JSON.stringify(obj, bigintReplacer);
}

function getTestnetScannerTxUrl<D extends keyof EvmDomains>(
  domain: D,
  txHash: string,
): string {
  const scanners: Partial<Record<keyof EvmDomains, string>> = {
    ["Ethereum"]: "https://sepolia.etherscan.io/tx/",
    ["Arbitrum"]: "https://sepolia.arbiscan.io/tx/",
    ["Optimism"]: "https://sepolia-optimism.etherscan.io/tx/",
  };

  const baseUrl = scanners[domain];

  if (!baseUrl) return "unknown scanner address";

  return `${baseUrl}${txHash}`;
}
