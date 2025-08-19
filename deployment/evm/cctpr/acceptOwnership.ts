// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Network, wormholeChainIdOf } from "@stable-io/cctp-sdk-definitions";
import { getCctpRGovernance } from "./src/cctpr.js";
import { init, getViemClient, getNetwork, ChainInfo, getOperatingChains, getViemSigner, buildOverridesWithGas } from "./src/common.js";
import { GovernanceCommand } from "@stable-io/cctp-sdk-cctpr-evm";
import { encoding } from "@stable-io/utils";

init();
const operatingChains = getOperatingChains();
const network = getNetwork();
async function run() {
  const cancelOwnershipTasks = operatingChains.map(chain =>
    acceptOwnershipTransfer(chain),
  );

  const results = await Promise.allSettled(cancelOwnershipTasks);
  const failedDomains: string[] = [];
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      failedDomains.push(operatingChains[index]!.domain);
      console.info(`\n==== ${operatingChains[index]!.domain} ====\n`);
      console.info(
        `Ownership transfer failed: ${result.reason?.stack || result.reason}`,
      );
    } else {
      console.info(`\nOwnership transfer accepted successfully on ${result.value.chain.domain}.`);
      console.info(`Transaction hash: ${result.value.hash}`);
    }
  }
  if (failedDomains.length > 0) {
    console.error(`\nOwnership transfer failed on ${failedDomains.join(", ")}`);
  } else {
    console.info(`\nOwnership transfer successfuly accepted on all domains.`);
  }
}

async function acceptOwnershipTransfer(chain: ChainInfo) {
  console.info(`Cancelling Ownership Transfer on: ${chain.domain}`);

  const signer = getViemSigner(network, chain);
  const viemClient = getViemClient(network, chain);
  const cctpr = getCctpRGovernance(viemClient, chain);
  const commands: GovernanceCommand<Network>[] = [{
    command: "acceptOwnershipTransfer",
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
  return { commands, chain, hash };
}

await run();
