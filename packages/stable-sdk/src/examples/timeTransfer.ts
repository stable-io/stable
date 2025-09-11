// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import dotenv from "dotenv";
import { Address } from "viem";
import { ViemSigner } from "../signer/viemSigner.js";
import { privateKeyToAccount } from "viem/accounts";
import StableSDK, { Route } from "../index.js";
import { writeFileSync, appendFileSync, existsSync } from "node:fs";
import { ExecutionTracker, ExecutionResult, formatTimeDiff } from "./utils.js";

dotenv.config();
const privateKey = process.env.EVM_PRIVATE_KEY as Address;
const account = privateKeyToAccount(privateKey);

const sender = account.address;
const recipient = account.address;

const rpcUrls = {
  Ethereum: "https://dimensional-solemn-scion.quiknode.pro/585eb5fde76eda6d2b9e4f6a150ec7bf4df12af1",
  Optimism: "https://dimensional-solemn-scion.optimism.quiknode.pro/585eb5fde76eda6d2b9e4f6a150ec7bf4df12af1",
  Base: "https://dimensional-solemn-scion.base-mainnet.quiknode.pro/585eb5fde76eda6d2b9e4f6a150ec7bf4df12af1",
  Arbitrum: "https://dimensional-solemn-scion.arbitrum-mainnet.quiknode.pro/585eb5fde76eda6d2b9e4f6a150ec7bf4df12af1",
  Polygon: "https://dimensional-solemn-scion.matic.quiknode.pro/585eb5fde76eda6d2b9e4f6a150ec7bf4df12af1",
  Unichain: "https://dimensional-solemn-scion.unichain-mainnet.quiknode.pro/585eb5fde76eda6d2b9e4f6a150ec7bf4df12af1",
};

const sdk = new StableSDK({
  network: "Mainnet",
  signer: {
    Evm: new ViemSigner(account),
  },
  rpcUrls,
});

const intent = {
  sourceChain: "Arbitrum" as const,
  targetChain: "Optimism" as const,
  amount: "0.01",
  sender,
  recipient,
  // gasDropoffDesired: eth("0.0015").toUnit("atomic"),
  paymentToken: "native" as const,
};

const scriptConfig = {
  numExecutions: 1,
  corridorToExecute: "v2Direct", // v1, v2Direct
  outputFile: "time-transfer-execution-results.csv",
  gasless: false as boolean,
};

/**
 * Run the script.
 */
try {
  logScriptConfiguration();

  initializeCsvFile();

  const allResults: ExecutionResult[] = [];

  for (let i = 1; i <= scriptConfig.numExecutions; i++) {
    const results = await executeRouteWithTiming(i);
    allResults.push(...results);
  }

  logScriptSummary(allResults);
} catch (error) {
  console.info("Error:", error);
}

// Execute a single route with timing tracking
async function executeRouteWithTiming(
  executionNumber: number,
): Promise<ExecutionResult[]> {
  console.info(`\n=== Execution ${executionNumber} ===`);

  const routes = await sdk.findRoutes(intent);
  const allRoutes = routes.all
  .filter(
    r => r.corridor === scriptConfig.corridorToExecute,
  )
  // if you want only gasless:
  .filter(
    r => r.steps.some(
      s => (scriptConfig.gasless ? s.type === "gasless-transfer" : s.type === "transfer"),
    ),
  );

  if (allRoutes.length === 0)
    throw new Error("No Routes Resulting of Filter");

  const executionResults: ExecutionResult[] = [];

  for (const [routeIndex, selectedRoute] of allRoutes.entries()) {
    logFees(selectedRoute);

    const routeDescription = `${executionNumber}-${routeIndex + 1}`;

    const executionResult = new ExecutionTracker(selectedRoute);

    const hasBalance = await sdk.checkHasEnoughFunds(selectedRoute);

    if (hasBalance) {
      try {
        await sdk.executeRoute(selectedRoute);
        console.info(
          `✅ Route ${routeDescription} completed successfully.`,
        );
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        executionResult.markExecutionFailed(errorMessage);
        console.info(`❌ Route ${routeDescription} failed with error:`, errorMessage);
      }
    }

    else {
      const errorMessage = `${
        selectedRoute.intent.sender
      } doesn't have enough balance to pay for the transfer`;
      executionResult.markExecutionFailed(errorMessage);
      console.info(`❌ Route ${routeDescription} failed:`, errorMessage);
    }

    const result = executionResult.getResult();
    console.info(`Estimated execution time: ${selectedRoute.estimatedDuration}`);
    console.info(`Real execution time: ${formatTimeDiff(result.totalDuration)}`);
    writeResultToCsv(result);
    executionResults.push(result);
  }

  return executionResults;
}

/**
 * Tracking and data formatting utilities
 */

function initializeCsvFile() {
  const headers = [
    "source",
    "target",
    "corridor",
    "route_type",
    "approval_type",
    "error_occurred",
    "total_duration_ms",
    "time_to_approval_ms",
    "time_to_transfer_sent_ms",
    "time_to_transfer_confirmed_ms",
    "time_to_transfer_received_ms",
    "transfer_hash",
    "receive_hash",
    "error_message",
  ].join(",");

  if (!existsSync(scriptConfig.outputFile)) {
    writeFileSync(scriptConfig.outputFile, headers + "\n");
  }
}

function writeResultToCsv(result: ExecutionResult) {
  const formatOptionalTiming = (value: number | undefined): string => {
    return value === undefined ? "N/A" : value.toFixed(2);
  };

  const row = [
    result.source,
    result.target,
    result.corridor,
    result.routeType,
    result.approvalType,
    result.errorOccurred,
    result.totalDuration.toFixed(2),
    formatOptionalTiming(result.stepTimings.approval),
    result.stepTimings.transferSent?.toFixed(2) || "",
    result.stepTimings.transferConfirmed?.toFixed(2) || "",
    result.stepTimings.transferReceived?.toFixed(2) || "",
    result.transferHash || "",
    result.receiveHash || "",
    `"${result.errorMessage || ""}"`,
  ].join(",");

  appendFileSync(scriptConfig.outputFile, row + "\n");
  console.info(`📝 Results written to ${scriptConfig.outputFile}`);
}

function logScriptConfiguration() {
  console.info(`🚀 Starting ${scriptConfig.numExecutions} sequential route executions`);
  console.info(`Transferring from ${intent.sourceChain} to ${intent.targetChain}`);
  console.info(`Amount: ${intent.amount} USDC`);
  console.info(`Sender/Recipient: ${sender}`);
  console.info(`Results will be saved to: ${scriptConfig.outputFile}`);
  console.info(`⏱️  Step timings show duration between consecutive steps`);
}

function logScriptSummary(results: ExecutionResult[]) {
  console.info(`Total executions: ${results.length}`);
  console.info(`Successful: ${results.filter(r => !r.errorOccurred).length}`);
  console.info(`Failed: ${results.filter(r => r.errorOccurred).length}`);

  const successfulResults = results.filter(r => !r.errorOccurred);
  if (successfulResults.length > 0) {
    const avgDuration = successfulResults.reduce(
      (sum, r) => sum + r.totalDuration,
    0) / successfulResults.length;
    console.info(`Average execution time: ${formatTimeDiff(avgDuration)}`);

    const avgSteps = successfulResults.reduce(
      (sum, r) => sum + Object.keys(r.stepTimings).length,
    0) / successfulResults.length;
    console.info(`Average steps per execution: ${avgSteps.toFixed(1)}`);

    // Step timing averages (now showing time between steps)
    const stepTimings = ["approval", "transferSent", "transferConfirmed", "transferReceived"] as const;

    console.info(`\nAverage step durations (time between consecutive steps):`);
    for (const step of stepTimings) {
      const values = successfulResults
        .map(r => r.stepTimings[step])
        .filter((v): v is number => v !== undefined);

      if (values.length > 0) {
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        console.info(`  ${step}: ${formatTimeDiff(avg)}`);
      }
    }
  }

  console.info(`\n📁 Results saved to: ${scriptConfig.outputFile}`);
}

function logFees(route: Route<any, any, any>) {
  console.info("Fees:");

  for (const fee of route.fees) {
    console.info(`    ${fee}`);
  }
}
