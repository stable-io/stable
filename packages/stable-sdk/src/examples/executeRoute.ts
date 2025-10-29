// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import dotenv from "dotenv";
import { Address } from "viem";
import { Domain } from "@stable-io/cctp-sdk-definitions";
import { ViemSigner } from "../signer/viemSigner.js";
import { privateKeyToAccount } from "viem/accounts";
import StableSDK, { Route } from "../index.js";
import { bigintReplacer } from "../utils.js";
import { SolanaKitSigner } from "../signer/solanaKitSigner.js";

dotenv.config();
const evmPrivateKey = process.env.EVM_PRIVATE_KEY as Address | undefined;
if (!evmPrivateKey) {
  throw new Error("EVM_PRIVATE_KEY is not set");
}
const evmAccount = privateKeyToAccount(evmPrivateKey);

const solanaPrivateKeyFile = process.env.SOLANA_PRIVATE_KEY_FILE;
if (!solanaPrivateKeyFile) {
  throw new Error("SOLANA_PRIVATE_KEY_FILE is not set");
}
const solanaAccount = await SolanaKitSigner.loadKeyPairSigner(solanaPrivateKeyFile);

const rpcUrls = {
  Polygon: "https://rpc-amoy.polygon.technology",
  Ethereum: "https://dimensional-solemn-scion.ethereum-sepolia.quiknode.pro/585eb5fde76eda6d2b9e4f6a150ec7bf4df12af1/",
  Solana: "https://api.devnet.solana.com",
};

const sdk = new StableSDK({
  network: "Testnet",
  signer: {
    Evm: new ViemSigner(evmAccount),
    Solana: new SolanaKitSigner(solanaAccount),
  },
  rpcUrls,
});

const getAddress = (domain: Domain) => domain === "Solana" ? solanaAccount.address : evmAccount.address;
const sourceChain = "Solana" as const;
const targetChain = "Ethereum" as const; 

const intent = {
  sourceChain,
  targetChain,
  amount: "0.3",
  sender: getAddress(sourceChain),
  recipient: getAddress(targetChain),
  // To receive gas tokens on the target. Increases the cost of the transfer.
  gasDropoffDesired: "0.0000001",
  paymentToken: "usdc" as const,
};

const routes = await sdk.findRoutes(intent);
const selectedRoutes = [routes.cheapest];

for (const route of selectedRoutes) {
  const balance = await sdk.checkHasEnoughFunds(route);
  if (!balance.hasEnoughBalance) {
    console.info(`${route.intent.sender} doesn't have enough balance to pay for the transfer`);
    console.info(`Required balance: ${stringify(balance.requiredBalance)}`);
    console.info(`Available balance: ${stringify(balance.availableBalance)}`);
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
  console.info(`Sender: ${intent.sender}`);
  console.info(`Recipient: ${intent.recipient}`);
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
  return JSON.stringify(obj, bigintReplacer, 2);
}

function getTestnetScannerTxUrl(
  domain: Domain,
  txHash: string,
): string {
  const scanners: Partial<Record<Domain, string>> = {
    ["Ethereum"]: "https://sepolia.etherscan.io/tx/{tx}",
    ["Avalanche"]: "https://subnets-test.avax.network/c-chain/tx/{tx}",
    ["Arbitrum"]: "https://sepolia.arbiscan.io/tx/{tx}",
    ["Optimism"]: "https://sepolia-optimism.etherscan.io/tx/{tx}",
    ["Solana"]: "https://explorer.solana.com/tx/{tx}?cluster=devnet",
    ["Polygon"]: "https://amoy.polygonscan.com/tx/{tx}",
    ["Base"]: "https://sepolia.basescan.org/tx/{tx}",
    ["Unichain"]: "https://unichain-sepolia.blockscout.com/tx/{tx}",
  };
  const baseUrl = scanners[domain];
  if (!baseUrl)
    return "unknown scanner address";
  return baseUrl.replace("{tx}", txHash);
}
