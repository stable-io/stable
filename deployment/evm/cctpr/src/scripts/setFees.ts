// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { DomainsOf, Network } from "@stable-io/cctp-sdk-definitions";
import { getCctpRGovernance, loadFeeAdjustments, adjustmentEquals } from "../helpers/cctpr.js";
import {
  init,
  ChainInfo,
  getOperatingChains,
  getViemClient,
  getNetwork,
  buildOverridesWithGas,
  getViemSigner,
} from "../helpers/common.js";
import { FeeAdjustmentType } from "@stable-io/cctp-sdk-cctpr-definitions";
import {
  CctpRGovernance,
  FeeAdjustment,
  GovernanceCommand,
} from "@stable-io/cctp-sdk-cctpr-evm";
import { encoding } from "@stable-io/utils";
import { Hex, TransactionReceipt } from "viem";

const processName = "configureCCTPRFees";
init();
const operatingChains = getOperatingChains();

async function run() {
  console.info(`Start! ${processName}`);

  const updateTasks = operatingChains.map(chain =>
    updateCctpRConfiguration(chain),
  );
  const results = await Promise.allSettled(updateTasks);
  for (const result of results) {
    if (result.status === "rejected") {
      console.info(
        `Updates processing failed: ${result.reason?.stack || result.reason}`,
      );
    } else {
      // Print update details; this reflects the exact updates requested to the contract.
      // Note that we assume that this update element was added because
      // some modification was requested to the contract.
      // This depends on the behaviour of the process functions.
      printUpdate(result.value.commands as any, result.value.chain);
    }
  }
}

function printUpdate(commands: GovernanceCommand[], { chainId }: ChainInfo) {
  const messages: string[] = [];

  // TODO: implement command explanation
  for (const command of commands) {
    messages.push(`Chain: ${chainId}, ${JSON.stringify(command, undefined, 2)}`);
  }

  console.info(messages.join("\n"));
}

async function updateCctpRConfiguration(chain: ChainInfo) {
  const network = getNetwork();
  const signer = getViemSigner(network, chain);
  const viemClient = getViemClient(network, chain);
  const cctpr = getCctpRGovernance(viemClient, chain) as any;

  const commands = await processFeeAdjustments(cctpr);

  if (commands.length === 0) {
    console.info(`No updates for operating chain ${chain.chainId}`);
    return { commands, chain };
  }

  const partialTx = cctpr.execGovernance(commands);

  console.info(`Sending update tx for operating chain ${chain.chainId}.`);
  console.info(`Updates: ${JSON.stringify(commands)}`);

  let hash: Hex;
  let receipt: TransactionReceipt;
  try {
    const overrides = await buildOverridesWithGas(
      viemClient,
      partialTx,
      chain,
    );
    hash = await signer.sendTransaction({
      data: encoding.hex.encode(partialTx.data, true),
      to: partialTx.to.toString(),
      value: partialTx.value?.toUnit("atomic"),
      ...overrides,
    });
    receipt = await viemClient.client.waitForTransactionReceipt({ hash });
  } catch (error: any) {
    console.error(
      `Updates failed on operating chain ${chain.chainId}. Error: ${error?.stack || error}`,
    );
    throw error;
  }

  if (receipt.status !== "success") {
    throw new Error(
      `Updates failed on operating chain ${chain.chainId}. Tx id ${hash}`,
    );
  }

  return { commands, chain };
}

export function adjustmentDiffers(current: FeeAdjustment[], expected: FeeAdjustment[]): boolean {
  if (current.length !== expected.length) {
    throw new Error("Unexpected different lengths of fee adjustments arrays.");
  }
  for (const [i, currentAdjustment] of current.entries()) {
    if (!adjustmentEquals(currentAdjustment, expected[i]!)) {
      return true;
    }
  }
  return false;
}

async function processFeeAdjustments(
  cctpr: CctpRGovernance,
) {
  const commands = [] as GovernanceCommand[];
  for (const [type, expectedAdjustments] of Object.entries(loadFeeAdjustments())) {
    const currentAdjustments = await cctpr.getFeeAdjustments(type as FeeAdjustmentType);
    for (let mappingIndex = 0; mappingIndex < CctpRGovernance.adjustmentSlots; ++mappingIndex) {
      const current = CctpRGovernance.feeAdjustmentsAtIndex(currentAdjustments, mappingIndex);
      const expected = CctpRGovernance.feeAdjustmentsAtIndex(expectedAdjustments, mappingIndex);
      if (adjustmentDiffers(current, expected)) {
        commands.push({
          command: "updateFeeAdjustments",
          feeType: type as FeeAdjustmentType,
          mappingIndex,
          adjustments: expected },
        );
      }
    }
  }
  return commands;
}

await run();
console.info(`Done! ${processName}`);
