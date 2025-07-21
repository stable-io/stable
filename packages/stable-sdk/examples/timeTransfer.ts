// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import dotenv from "dotenv";
import { Address } from "viem";
import { EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { ViemSigner } from "../src/signer/viemSigner.js";
import { privateKeyToAccount } from "viem/accounts";
import StableSDK from "../src/index.js";
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
  sourceChain: "Ethereum" as const,
  targetChain: "Optimism" as const,
  amount: "0.1",
  sender,
  recipient,
  // To receive gas tokens on the target. Increases the cost of the transfer.
  // gasDropoffDesired: eth("0.0015").toUnit("atomic"),

  paymentToken: "usdc" as const, // defaults to usdc
};

// Configuration for multiple executions
const NUM_EXECUTIONS = 50; // Change this to desired number of executions
const CSV_FILE = "transfer_timing_results.csv";

// Format timing with color based on duration
function formatTimeDiff(timeMs: number): string {
  const timeStr = `+${timeMs.toFixed(2)}ms`;

  if (timeMs < 2000) {
    // Green for under 2 seconds
    return `\u001B[32m${timeStr}\u001B[0m`;
  } else if (timeMs <= 5000) {
    // Yellow for 2-5 seconds
    return `\u001B[33m${timeStr}\u001B[0m`;
  } else {
    // Red for over 5 seconds
    return `\u001B[31m${timeStr}\u001B[0m`;
  }
}

// Types for timing data
interface StepTimings {
  transferInitiated?: number;
  approvalSent?: number;
  messageSigned?: number;
  transferSent?: number;
  transferConfirmed?: number;
  hopReceived?: number;
  hopConfirmed?: number;
  transferReceived?: number;
  error?: number;
}

interface ExecutionResult {
  executionNumber: number;
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
    "execution_number",
    "time_to_transfer_initiated_ms",
    "time_to_approval_sent_ms",
    "time_to_message_signed_ms",
    "time_to_transfer_sent_ms",
    "time_to_transfer_confirmed_ms",
    "time_to_hop_received_ms",
    "time_to_hop_confirmed_ms",
    "time_to_transfer_received_ms",
    "corridor",
    "transfer_hash",
    "receive_hash",
    "total_duration_ms",
    "error_occurred",
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
    result.executionNumber,
    result.stepTimings.transferInitiated?.toFixed(2) || "",
    formatOptionalTiming(result.stepTimings.approvalSent),
    formatOptionalTiming(result.stepTimings.messageSigned),
    result.stepTimings.transferSent?.toFixed(2) || "",
    result.stepTimings.transferConfirmed?.toFixed(2) || "",
    formatOptionalTiming(result.stepTimings.hopReceived),
    formatOptionalTiming(result.stepTimings.hopConfirmed),
    result.stepTimings.transferReceived?.toFixed(2) || "",
    result.corridor,
    result.transferHash || "",
    result.receiveHash || "",
    result.totalDuration.toFixed(2),
    result.errorOccurred,
    `"${result.errorMessage || ""}"`,
  ].join(",");

  appendFileSync(CSV_FILE, row + "\n");
  console.info(`📝 Results written to ${CSV_FILE}`);
}

// Execute a single route with timing tracking
async function executeRouteWithTiming(
  executionNumber: number,
): Promise<ExecutionResult> {
  console.info(`\n=== Execution ${executionNumber} ===`);

  const result: ExecutionResult = {
    executionNumber,
    corridor: "",
    stepTimings: {},
    totalDuration: 0,
    errorOccurred: false,
  };

  const executionStartTime = performance.now();

  try {
    const routes = await sdk.findRoutes(intent);
    const selectedRoute = routes.all[1]; // change to select a different route.

    result.corridor = selectedRoute.corridor;

    const hasBalance = await sdk.checkHasEnoughFunds(selectedRoute);
    if (!hasBalance) {
      throw new Error(
        `${selectedRoute.intent.sender} doesn't have enough balance to pay for the transfer`,
      );
    }

    const stepStartTime = performance.now();
    let lastStepTime: number;

    selectedRoute.progress.on("transfer-initiated", () => {
      const now = performance.now();
      result.stepTimings.transferInitiated = now - stepStartTime;
      lastStepTime = now;
      console.info(`✓ Transfer initiated (${
        formatTimeDiff(result.stepTimings.transferInitiated)})`);
    });

    selectedRoute.progress.on("approval-sent", (e) => {
      const now = performance.now();
      result.stepTimings.approvalSent = now - lastStepTime;
      lastStepTime = now;
      console.info(`✓ Approval sent: ${e.transactionHash} (
        ${formatTimeDiff(result.stepTimings.approvalSent)})`);
    });

    selectedRoute.progress.on("message-signed", (e) => {
      const now = performance.now();
      result.stepTimings.messageSigned = now - lastStepTime;
      lastStepTime = now;
      console.info(`✓ Message signed by ${e.signer} (${
        formatTimeDiff(result.stepTimings.messageSigned)})`);
    });

    selectedRoute.progress.on("transfer-sent", (e) => {
      const now = performance.now();
      result.stepTimings.transferSent = now - lastStepTime;
      lastStepTime = now;
      console.info(`✓ Transfer tx included in blockchain. tx: ${
        e.transactionHash} (${formatTimeDiff(result.stepTimings.transferSent)})`);
    });

    selectedRoute.progress.on("transfer-confirmed", (e) => {
      const now = performance.now();
      result.stepTimings.transferConfirmed = now - lastStepTime;
      lastStepTime = now;
      console.info(`✓ Transfer confirmed - Circle attestation received (${
        formatTimeDiff(result.stepTimings.transferConfirmed)})`);
    });

    selectedRoute.progress.on("hop-received", (e) => {
      const now = performance.now();
      result.stepTimings.hopReceived = now - lastStepTime;
      lastStepTime = now;
      console.info(`✓ Hop received: ${e.transactionHash} (${
        formatTimeDiff(result.stepTimings.hopReceived)})`);
    });

    selectedRoute.progress.on("hop-confirmed", (e) => {
      const now = performance.now();
      result.stepTimings.hopConfirmed = now - lastStepTime;
      lastStepTime = now;
      console.info(`✓ Hop confirmed (${
        formatTimeDiff(result.stepTimings.hopConfirmed)})`);
    });

    selectedRoute.progress.on("transfer-received", (e) => {
      const now = performance.now();
      result.stepTimings.transferReceived = now - lastStepTime;
      lastStepTime = now;
      console.info(`✓ Transfer received: ${e.transactionHash} (${
        formatTimeDiff(result.stepTimings.transferReceived)})`);
    });

    selectedRoute.progress.on("error", (e) => {
      const now = performance.now();
      result.stepTimings.error = now - lastStepTime;
      result.errorOccurred = true;
      result.errorMessage = e.type;
      console.error(`✗ Error: ${e.type} (${
        formatTimeDiff(result.stepTimings.error)})`);
    });

    const {
      transferHash,
      receiveHash,
    } = await sdk.executeRoute(selectedRoute);

    result.transferHash = transferHash;
    result.receiveHash = receiveHash;

    console.info(`✅ Execution ${executionNumber} completed successfully.\
      \nSend: ${getTestnetScannerTxUrl(selectedRoute.intent.sourceChain, transferHash)}\
      \nReceive: ${getTestnetScannerTxUrl(selectedRoute.intent.targetChain, receiveHash)}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errorOccurred = true;
    result.errorMessage = errorMessage;
    console.error(`❌ Execution ${executionNumber} failed:`, errorMessage);
  }

  const executionEndTime = performance.now();
  result.totalDuration = executionEndTime - executionStartTime;

  console.info(`Total execution time: ${formatTimeDiff(result.totalDuration)}`);

  return result;
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
    const result = await executeRouteWithTiming(i);
    allResults.push(result);

    writeResultToCsv(result);
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
    const stepTimings = ["transferInitiated", "approvalSent", "messageSigned", "transferSent", "transferConfirmed", "hopReceived", "hopConfirmed", "transferReceived"] as const;

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

// Run the script
try {
  await runMultipleExecutions();
} catch (error) {
  console.error("Error:", error);
}
