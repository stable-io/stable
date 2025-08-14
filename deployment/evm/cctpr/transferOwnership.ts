// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Network } from "@stable-io/cctp-sdk-definitions";
import { getCctpRGovernance } from "./src/cctpr.js";
import {
  init,
  ChainInfo,
  getOperatingChains,
  getViemClient,
  getNetwork,
  buildOverridesWithGas,
  getViemSigner,
} from "./src/common.js";
import {
  GovernanceCommand,
} from "@stable-io/cctp-sdk-cctpr-evm";
import { encoding } from "@stable-io/utils";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";

init();
const operatingChains = getOperatingChains();

const waitForInput = async () => {
  process.stdin.setRawMode(true);
  return new Promise(resolve => process.stdin.once('data', () => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    resolve(undefined);
  }));
}

async function run() {
  const newOwnerAddressValue = process.env.NEW_OWNER_ADDRESS;
  if (newOwnerAddressValue === undefined) {
    throw new Error("NEW_OWNER_ADDRESS environment variable needs to be set");
  }
  if (process.env.WALLET_KEY === undefined) {
    throw new Error("WALLET_KEY environment variable needs to be set");
  }
  const newOwnerAddress = new EvmAddress(newOwnerAddressValue);
  console.info(`TRANSFERING OWNERSHIP TO: ${newOwnerAddressValue}`);

  console.info(`Press any key to initiate the ownership transfer...\n`);
  await waitForInput();

  const updateTasks = operatingChains.map(chain =>
    transferOwnership(chain, newOwnerAddress),
  );
  const results = await Promise.allSettled(updateTasks);
  const failedDomains: string[] = [];
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      failedDomains.push(operatingChains[index].domain);
      console.info(`\n==== ${operatingChains[index].domain} ====\n`);
      console.info(
        `Ownership transfer failed: ${result.reason?.stack || result.reason}`,
      );
    } else {
      console.info(`\nOwnership transfer successful on ${result.value.chain.domain}.\n`);
    }
  }
  if (failedDomains.length > 0) {
    console.error(`\nOwnership transfer failed on ${failedDomains.join(", ")}`);
  } else {
    console.info(`\nOwnership transfer successful on all domains.`);
  }
}

async function transferOwnership(chain: ChainInfo, newOwnerAddress: EvmAddress) {
  const network = getNetwork();
  const signer = getViemSigner(network, chain);
  const viemClient = getViemClient(network, chain);
  const cctpr = getCctpRGovernance(viemClient, chain);

  // Check current owner
  const currentOwner = await cctpr.getRole("owner");
  console.info(`Current owner on ${chain.domain}: ${currentOwner.toString()}`);
  console.info(`Transferring ownership to: ${newOwnerAddress.toString()}`);

  // Create ownership transfer command
  const commands: GovernanceCommand<Network>[] = [{
    command: "proposeOwnershipTransfer",
    address: newOwnerAddress,
  }];

  const partialTx = cctpr.execGovernance(commands);

  const overrides = await buildOverridesWithGas(
    viemClient,
    partialTx,
    chain,
  );
  const hash = await signer.sendTransaction({
    data: encoding.hex.encode(partialTx.data, true),
    to: partialTx.to.toString(),
    value: partialTx.value?.toUnit("atomic"),
    ...overrides,
  });
  const receipt = await viemClient.client.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(
      `Ownership transfer failed on ${chain.domain}. Tx id ${hash}`,
    );
  }

  console.info(`Ownership transfer transaction successful on ${chain.domain}. Tx hash: ${hash}`);
  console.info(`  IMPORTANT: The new owner (${newOwnerAddress.toString()}) must now call acceptOwnershipTransfer to complete the transfer.`);

  return { commands, chain };
}

await run();