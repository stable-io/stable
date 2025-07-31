// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import dotenv from "dotenv";
import { Address } from "viem";
import { EvmDomains, eth } from "@stable-io/cctp-sdk-definitions";
import { ViemSigner } from "../signer/viemSigner.js";
import { privateKeyToAccount } from "viem/accounts";
import StableSDK, { Route } from "../index.js";
import { writeFileSync, appendFileSync, existsSync } from "node:fs";

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
  sourceChain: "Optimism" as const,
  targetChain: "Ethereum" as const,
  amount: "0.1",
  sender,
  recipient,
  // gasDropoffDesired: eth("0.0015").toUnit("atomic"),
  paymentToken: "native" as const,
};

// Configuration for multiple executions
const NUM_EXECUTIONS = 30; // Change this to desired number of executions
const CORRIDOR_TO_EXECUTE = "v1"; // v1, v2Direct
const CSV_FILE = "opt-eth.csv";
const gasless = false as true | false;

// Format timing with color based on duration
function formatTimeDiff(timeMs: number): string {
  const timeStr = `+${timeMs.toFixed(2)}ms`;

  if (timeMs < 2000) {
    // Green for under 2 seconds
    return `\u001B[32m${timeStr}\u001B[0m`;
  } else if (timeMs <= 10000) {
    // Yellow for 2-10 seconds
    return `\u001B[33m${timeStr}\u001B[0m`;
  } else {
    // Red for over 10 seconds
    return `\u001B[31m${timeStr}\u001B[0m`;
  }
}

// Types for timing data
interface StepTimings {
  approval?: number;
  transferSent?: number;
  transferConfirmed?: number;
  transferReceived?: number;
  error?: number;
}

interface ExecutionResult {
  routeType?: string;
  approvalType?: string;
  transferHash?: string;
  receiveHash?: string;
  stepTimings: StepTimings;
  totalDuration: number;
  errorOccurred: boolean;
  errorMessage?: string;
  corridor: string;
}

// Initialize CSV file with headers
function initializeCsvFile() {
  const headers = [
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

  if (!existsSync(CSV_FILE)) {
    writeFileSync(CSV_FILE, headers + "\n");
  }
}

// Write execution result to CSV
function writeResultToCsv(result: ExecutionResult) {
  const formatOptionalTiming = (value: number | undefined): string => {
    return value === undefined ? "N/A" : value.toFixed(2);
  };

  const row = [
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

  appendFileSync(CSV_FILE, row + "\n");
  console.info(`📝 Results written to ${CSV_FILE}`);
}

// Execute a single route with timing tracking
async function executeRouteWithTiming(
  executionNumber: number,
): Promise<ExecutionResult[]> {
  console.info(`\n=== Execution ${executionNumber} ===`);

  const routes = await sdk.findRoutes(intent);
  const allRoutes = routes.all
  .filter(
    r => r.corridor === CORRIDOR_TO_EXECUTE,
  )
  // if you want only gasless:
  .filter(
    r => r.steps.some(s => (gasless ? s.type === "gasless-transfer" : s.type === "transfer")),
  );

  if (allRoutes.length === 0)
    throw new Error("No Routes Resulting of Filter");

  const executionResults: ExecutionResult[] = [];

  for (let routeIndex = 0; routeIndex < allRoutes.length; routeIndex++) {
    const selectedRoute = allRoutes[routeIndex];
    const routeDescription = `${executionNumber}-${routeIndex + 1}`;

    console.info(`\n--- Route ${routeIndex + 1}/${allRoutes.length} (${
      getRouteType(selectedRoute)} - ${selectedRoute.corridor}) ---`);

    const result: ExecutionResult = {
      corridor: selectedRoute.corridor,
      stepTimings: {},
      totalDuration: 0,
      errorOccurred: false,
      routeType: getRouteType(selectedRoute),
      approvalType: getApprovalType(selectedRoute),
    };

    const executionStartTime = performance.now();

    try {
      const hasBalance = await sdk.checkHasEnoughFunds(selectedRoute);
      if (!hasBalance) {
        throw new Error(
          `${selectedRoute.intent.sender} doesn't have enough balance to pay for the transfer`,
        );
      }

      const stepStartTime = performance.now();
      let lastStepTime: number;

      selectedRoute.progress.on("approval-sent", (e) => {
        const now = performance.now();
        result.stepTimings.approval = now - stepStartTime;
        lastStepTime = now;
        console.info(`✓ Approval sent: ${e.transactionHash} (${
          formatTimeDiff(result.stepTimings.approval)})`);
      });

      selectedRoute.progress.on("message-signed", (e) => {
        const now = performance.now();
        result.stepTimings.approval = now - stepStartTime;
        lastStepTime = now;
        console.info(`✓ Message signed by ${e.signer}. Deadline: ${
          e.messageSigned.message.deadline
        } (${
          formatTimeDiff(result.stepTimings.approval)})`);
      });

      selectedRoute.progress.on("transfer-sent", (e) => {
        const now = performance.now();
        result.stepTimings.transferSent = now - lastStepTime;
        lastStepTime = now;
        console.info(`✓ Transfer tx included in blockchain. tx: ${
          e.transactionHash} (${formatTimeDiff(result.stepTimings.transferSent)})`);

        result.transferHash = e.transactionHash;
      });

      selectedRoute.progress.on("transfer-confirmed", (e) => {
        const now = performance.now();
        result.stepTimings.transferConfirmed = now - lastStepTime;
        lastStepTime = now;
        console.info(`✓ Transfer confirmed - Circle attestation received (${
          formatTimeDiff(result.stepTimings.transferConfirmed)})`);
      });

      selectedRoute.progress.on("transfer-received", (e) => {
        const now = performance.now();
        result.stepTimings.transferReceived = now - lastStepTime;
        lastStepTime = now;
        console.info(`✓ Transfer received: ${e.transactionHash} (${
          formatTimeDiff(result.stepTimings.transferReceived)})`);

        result.receiveHash = e.transactionHash;
      });

      selectedRoute.progress.on("error", (e) => {
        const now = performance.now();
        result.stepTimings.error = now - lastStepTime;
        result.errorOccurred = true;
        result.errorMessage = e.type;
        console.info(`✗ Error: ${e.type} (${
          formatTimeDiff(result.stepTimings.error)})`);
      });

      await sdk.executeRoute(selectedRoute);
      console.info(
        `✅ Route ${routeDescription} completed successfully.\
        \nSend: ${getTestnetScannerTxUrl(selectedRoute.intent.sourceChain, result.transferHash!)}\
        \rRcv: ${getTestnetScannerTxUrl(selectedRoute.intent.targetChain, result.receiveHash!)}`,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errorOccurred = true;
      result.errorMessage = errorMessage;
      console.info(`❌ Route ${routeDescription} failed:`, errorMessage);
    }

    const executionEndTime = performance.now();
    result.totalDuration = executionEndTime - executionStartTime;

    console.info(`Estimated execution time: ${selectedRoute.estimatedDuration}`);
    console.info(`Real execution time: ${formatTimeDiff(result.totalDuration)}`);
    writeResultToCsv(result);
    executionResults.push(result);
  }

  return executionResults;
}

async function runMultipleExecutions() {
  console.info(`🚀 Starting ${NUM_EXECUTIONS} sequential route executions`);
  console.info(`Transferring from ${intent.sourceChain} to ${intent.targetChain}`);
  console.info(`Amount: ${intent.amount} USDC`);
  console.info(`Sender/Recipient: ${sender}`);
  console.info(`Results will be saved to: ${CSV_FILE}`);
  console.info(`⏱️  Step timings show duration between consecutive steps`);

  initializeCsvFile();

  const allResults: ExecutionResult[] = [];

  for (let i = 1; i <= NUM_EXECUTIONS; i++) {
    const results = await executeRouteWithTiming(i);
    allResults.push(...results);
  }

  // Summary
  console.info(`\n📊 Summary:`);
  console.info(`Total executions: ${allResults.length}`);
  console.info(`Successful: ${allResults.filter(r => !r.errorOccurred).length}`);
  console.info(`Failed: ${allResults.filter(r => r.errorOccurred).length}`);

  const successfulResults = allResults.filter(r => !r.errorOccurred);
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

  console.info(`\n📁 Results saved to: ${CSV_FILE}`);
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

function getRouteType(r: Route<any, any>) {
  return r.steps.some(
    s => s.type === "gasless-transfer",
  )
? "gasless"
: "normal";
}

function getApprovalType(r: Route<any, any>) {
  return r.requiresMessageSignature ? "permit" : "approval";
}

// Run the script
try {
  await runMultipleExecutions();
} catch (error) {
  console.info("Error:", error);
}
