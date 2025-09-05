// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import dotenv from "dotenv";
import { Address } from "viem";
import { Domain, Network } from "@stable-io/cctp-sdk-definitions";
import { ViemSigner } from "../signer/viemSigner.js";
import { privateKeyToAccount } from "viem/accounts";
import StableSDK, { Route } from "../index.js";
import { bigintReplacer } from "../utils.js";
import { SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";

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
  });

  route.transactionListener.on("*", (e) => {
    console.info(`Transaction Event: ${e.name}.`);
    // console.info(`Data: ${stringify(e.data)}\n`);
  });

  logRouteInfo(route);
  console.info("Executing route...");

  const {
    transactions,
    attestations,
    receiveTxs,
    transferHash,
    receiveHash,
  } = await sdk.executeRoute(route);

  console.info(`Transfer Sent:`, getTestnetScannerTxUrl(route.intent.sourceChain, transferHash));
  console.info(`Transfer Received:`, getTestnetScannerTxUrl(route.intent.targetChain, receiveHash));
}

function logRouteInfo(route: Route<any, any, any>) {
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

function getTestnetScannerTxUrl(
  domain: Domain,
  txHash: string,
): string {
  const scanners: Partial<Record<Domain, string>> = {
    ["Ethereum"]: "https://sepolia.etherscan.io/tx/{tx}",
    ["Arbitrum"]: "https://sepolia.arbiscan.io/tx/{tx}",
    ["Optimism"]: "https://sepolia-optimism.etherscan.io/tx/{tx}",
    ["Solana"]: "https://explorer.solana.com/tx/{tx}?cluster=devnet",
  };
  const baseUrl = scanners[domain];
  if (!baseUrl)
    return "unknown scanner address";
  return baseUrl.replace("{tx}", txHash);
}
