// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { ViemSigner } from "../src/signer/viemSigner.js";
import { privateKeyToAccount } from "viem/accounts";
import StableSDK from "../src/index.js";
import { Address } from "viem";
import dotenv from "dotenv";
import { eth, EvmDomains } from "@stable-io/cctp-sdk-definitions";

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
  signer: new ViemSigner(account),
  rpcUrls,
});

const intent = {
  sourceChain: "Ethereum" as const,
  targetChain: "Arbitrum" as const,
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

  gasDropoffDesired: eth(0.002).toUnit("atomic"),
};

const routes = await sdk.findRoutes(intent, { paymentToken: "usdc" });

console.info(`Transfers from ${intent.sourceChain} to ${intent.targetChain}.`);
console.info(`Sender: ${sender}`);
console.info(`Recipient: ${recipient}`);

const selectedRoutes = [routes.all[3]];

for (const route of selectedRoutes) {
  console.info("--------------------------------");
  console.info("");
  console.info("");
  console.info(`Routing through corridor: ${route.corridor}`);
  console.info(
    "Token Authorization To use:",
    route.requiresMessageSignature ? "Permit" : "Approval",
  );
  console.info("Signatures required", route.steps.length);
  console.info(
    `Total Cost: $${route.estimatedTotalCost.toUnit("human").toString()}`,
  );
  console.info(`Estimated Duration: ${route.estimatedDuration}s`);

  console.info("Fees to pay:");

  for (const fee of route.fees) {
    console.info(`    ${fee}`);
  }

  console.info("Executing route...");
  const txHashes = await sdk.executeRoute(route);

  console.info("Route Executed. See transfer at:");
  console.info(
    `https://wormholescan.io/#/tx/${txHashes.at(-1)}?network=Testnet`,
  );
  console.info(`https://sepolia.etherscan.io/tx/${txHashes.at(-1)}`);

  console.info(getTestnetScannerAddressUrl(
    route.intent.targetChain,
    route.intent.recipient,
  ));
}

function getTestnetScannerAddressUrl<D extends keyof EvmDomains>(
  domain: D,
  addr: string,
): string {
  const scanners: Partial<Record<keyof EvmDomains, string>> = {
    ["Ethereum"]: "https://sepolia.etherscan.io/address/",
    ["Arbitrum"]: "https://sepolia.arbiscan.io/address/",
    ["Optimism"]: "https://sepolia-optimism.etherscan.io/address/",
  };

  const baseUrl = scanners[domain];

  if (!baseUrl) return "unknown scanner address";

  return `${baseUrl}${addr}`;
}
