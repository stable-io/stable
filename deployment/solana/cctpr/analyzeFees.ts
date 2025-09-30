// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Commitment, Connection, PublicKey } from "@solana/web3.js";
import {
  DEFAULT_COMPUTE_BUDGET_MICROLAMPORTS,
  getPrioritizationFeeFromList,
  getSortedPrioritizationFeeList,
  PriorityFeePolicy,
} from "./src/fees.js";
import { getNetwork, getRpcUrl } from "./src/env.js";
import { getDeploymentFilename, getDeploymentConfig, setDeploymentConfig } from "./src/deploy_config.js";

const connectionCommitmentLevel = (
  process.env["solana_commitment"] || "confirmed"
) as Commitment;

export type AnalyzeFeesResult = {
  max: number;
  high: number;
  normal: number;
  low: number;
}

export async function analyzeFees(
  connection: Connection,
  lockedWritableAccounts: PublicKey[]
): Promise<AnalyzeFeesResult | undefined> {
  const sortedList = await getSortedPrioritizationFeeList(connection, lockedWritableAccounts);
  if (sortedList.length === 0) {
    return undefined;
  }
  const getFee = (policy: PriorityFeePolicy) => getPrioritizationFeeFromList(sortedList, policy);
  return { max: getFee("max"), high: getFee("high"), normal: getFee("normal"), low: getFee("low") };
}

async function main() {
  // Parse each command line argument as a public key
  const lockedWritableAccounts = process.argv.slice(2).map(arg => new PublicKey(arg));
  const network = getNetwork();
  const connection = new Connection(getRpcUrl(network), connectionCommitmentLevel);
  if (lockedWritableAccounts.length === 0) {
    const configFile = getDeploymentFilename(network);
    console.info(`Analyzing fees for deployer account in ${configFile}...`);
    const deployer = [new PublicKey(getDeploymentConfig(network).cctpr_deployer)];
    const result = await analyzeFees(connection, deployer);
    if (result === undefined) {
      console.info(`\nNo prioritization fees found in recent blocks.`);
      console.info(`${DEFAULT_COMPUTE_BUDGET_MICROLAMPORTS} microLamports will be used.`);
    }
    const prioritization_fee = result?.max ?? DEFAULT_COMPUTE_BUDGET_MICROLAMPORTS; 
    setDeploymentConfig(network, { prioritization_fee });
    console.info(`Saved fee to ${configFile}: ${prioritization_fee} microLamports`);
  } else {
    const result = await analyzeFees(connection, lockedWritableAccounts);
    if (!result) {
      console.info(`\nNo prioritization fees found in recent blocks. Use either `);
      console.info(`   - ${DEFAULT_COMPUTE_BUDGET_MICROLAMPORTS} as minimum recommended value, or `);
      console.info(`   - "analyze-fees <account1> <account2> ..." to analyze specific accounts`);
      return;
    }
    console.info(`Max prioritization fee:                      ${result.max} microLamports`);
    console.info(`High   (95th-percentile) prioritization fee: ${result.high} microLamports`);
    console.info(`Normal (87th-percentile) prioritization fee: ${result.normal} microLamports`);
    console.info(`Low    (50th-percentile) prioritization fee: ${result.low} microLamports`);
  }
}

await main();
console.info("Done!");
