/* eslint-disable unicorn/no-process-exit */
// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { config } from "dotenv";
import { deserializeBigints } from "@stable-io/utils";
import { mnemonicToAccount } from "viem/accounts";

config();

console.info("=== Gasless Transfer API Complete Examples ===\n");

/**
 * This example demonstrates both gasless transfer API flows:
 *
 * SCENARIO 1: Basic gasless transfer (permit2PermitRequired=false)
 * - Simple quote request without additional permit
 * - Only permit2 typed data signing required
 * - Direct relay initiation
 *
 * SCENARIO 2: Gasless transfer with permit2 permit (permit2PermitRequired=true)
 * - Quote request requiring additional permit signature
 * - Both permit2 signature and permit data required
 * - Shows additional complexity for permit handling
 *
 * Environment Variables:
 * - PORT: Backend service port (default: 3000)
 * - TEST_MNEMONIC: Test wallet mnemonic (optional, defaults to test mnemonic)
 *
 * Usage:
 * 1. Start the backend service: yarn workspace @stable-io/back-end run start:dev
 * 2. Run this example: yarn workspace @stable-io/back-end run tsx examples/gaslessTransferApi.ts
 */

const PORT = process.env.PORT ?? "3000";
const API_BASE_URL = `http://localhost:${PORT}`;

interface QuoteResponse {
  data: {
    jwt: string;
  };
}

interface RelayResponse {
  data: {
    hash: `0x${string}`;
  };
}

interface JwtPayload extends Record<string, unknown> {
  permit2TypedData: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    message: Record<string, unknown>;
  };
  quoteRequest: Record<string, unknown>;
  gaslessFee: string;
}

interface TestScenario {
  name: string;
  description: string;
  parameters: Record<string, string>;
}

const apiRequest = async (
  endpoint: string,
  options: RequestInit = {},
): Promise<unknown> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const fetchOptions = {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers &&
      !(options.headers instanceof Headers) &&
      !Array.isArray(options.headers)
        ? options.headers
        : {}),
    },
    ...options,
  };
  console.info(`🌐 Making request to: ${url}`);

  try {
    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get("content-type");
    const data = contentType?.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      if (typeof data === "object" && data && "message" in data) {
        console.error(
          `❌ Validation Error (${response.status}):`,
          data.message,
        );
        if ("error" in data) {
          console.error("Error details:", data.error);
        }
      } else {
        console.error(`❌ HTTP Error (${response.status}):`, data);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.info(`✅ Response received`);
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes("HTTP")) {
      throw error;
    }
    console.error(`❌ Request failed:`, error);
    throw error;
  }
};

const decodeJwtPayload = (token: string): JwtPayload => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    const payload = parts[1];
    if (!payload) {
      throw new Error("Missing JWT payload");
    }

    const paddedPayload = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decodedPayload = atob(paddedPayload);
    return JSON.parse(decodedPayload) as JwtPayload;
  } catch (error) {
    console.error("Failed to decode JWT:", error);
    throw error;
  }
};

const checkServiceStatus = async (): Promise<void> => {
  console.info("\n🔍 Checking service status...");
  const statusResponse = await apiRequest("/gasless-transfer/status");
  console.info(`Status: ${String(statusResponse)}\n`);
};

const createTestScenarios = (): TestScenario[] => [
  {
    name: "Basic Gasless Transfer",
    description: "Standard flow without permit2 permit requirement",
    parameters: {
      sourceDomain: "Arbitrum",
      targetDomain: "Optimism",
      amount: "10.000000",
      sender: "0xcbe6A4D12762ce7AA71f32ACd925fC1829434bf4",
      recipient: "0xcbe6A4D12762ce7AA71f32ACd925fC1829434bf4",
      corridor: "v1",
      gasDropoff: "0.123456789012345678",
      permit2PermitRequired: "false",
      maxRelayFee: "10.000000",
      fastFeeRate: "1",
      takeFeesFromInput: "false",
    },
  },
  {
    name: "Gasless Transfer with Permit2 Permit",
    description: "Complex flow requiring additional permit2 permit signature",
    parameters: {
      sourceDomain: "Ethereum",
      targetDomain: "Arbitrum",
      amount: "1.500000",
      sender: "0xcbe6A4D12762ce7AA71f32ACd925fC1829434bf4",
      recipient: "0xcbe6A4D12762ce7AA71f32ACd925fC1829434bf4",
      corridor: "v2Direct",
      gasDropoff: "0.010000000000000000",
      permit2PermitRequired: "true",
      maxRelayFee: "2.000000",
      fastFeeRate: "0.1",
      takeFeesFromInput: "false",
    },
  },
];

const requestQuote = async (scenario: TestScenario): Promise<QuoteResponse> => {
  console.info(`\n📋 Requesting quote for: ${scenario.name}`);
  console.info(`Description: ${scenario.description}`);

  const quoteParams = new URLSearchParams(scenario.parameters);
  console.info("Parameters:", Object.fromEntries(quoteParams));

  const quoteResponse = await apiRequest(
    `/gasless-transfer/quote?${quoteParams}`,
  ) as QuoteResponse;

  return quoteResponse;
};

const processJwtPayload = (jwt: string, scenarioName: string): JwtPayload => {
  console.info(`\n🔓 Processing JWT for: ${scenarioName}`);
  console.info("JWT token:", jwt.slice(0, 50) + "...");

  const jwtPayload = decodeJwtPayload(jwt);
  const restoredPayload = deserializeBigints(jwtPayload) as JwtPayload;

  console.info("JWT contains:");
  console.info("- Permit2 permit required:", restoredPayload.quoteRequest.permit2PermitRequired);
  console.info("- Gasless fee:", restoredPayload.gaslessFee);
  console.info("- Source domain:", restoredPayload.quoteRequest.sourceDomain);
  console.info("- Target domain:", restoredPayload.quoteRequest.targetDomain);
  console.info("- Amount:", restoredPayload.quoteRequest.amount);

  return restoredPayload;
};

const signPermit2Data = async (
  payload: JwtPayload,
  scenarioName: string,
): Promise<string> => {
  console.info(`\n✍️  Signing permit2 typed data for: ${scenarioName}`);

  const mnemonic =
    process.env.TEST_MNEMONIC ??
    "test test test test test test test test test test test junk";
  const account = mnemonicToAccount(mnemonic);

  console.info(`Using wallet address: ${account.address}`);

  const signature = await account.signTypedData(payload.permit2TypedData as any);

  console.info("Permit2 signature:", signature.slice(0, 20) + "...");
  console.info("✅ Permit2 typed data successfully signed");

  return signature;
};

const createPermitData = async (
  payload: JwtPayload,
  scenarioName: string,
): Promise<any> => {
  const permitRequired = payload.quoteRequest.permit2PermitRequired as boolean;

  if (!permitRequired) {
    console.info(`\n📝 ${scenarioName}: No permit2 permit required`);
    return undefined;
  }

  console.info(`\n📝 ${scenarioName}: Creating permit2 permit data...`);

  const mnemonic =
    process.env.TEST_MNEMONIC ??
    "test test test test test test test test test test test junk";
  const account = mnemonicToAccount(mnemonic);

  // In a real application, you would:
  // 1. Check current USDC allowance for permit2 contract
  // 2. Create proper permit message for the required allowance
  // 3. Sign the permit message with the user's private key
  // 4. Return the permit signature, value, and deadline

  const permitData = {
    value: "2000000000", // 2000 USDC in 6 decimal format
    deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    signature: await account.signMessage({ message: "permit_placeholder" }), // Placeholder
  };

  console.info("Permit data created:");
  console.info("- Value:", permitData.value);
  console.info("- Deadline:", new Date(permitData.deadline * 1000).toISOString());
  console.info("- Signature:", permitData.signature.slice(0, 20) + "...");

  return permitData;
};

const initiateGaslessTransfer = async (
  jwt: string,
  permit2Signature: string,
  permit: any,
  scenarioName: string,
): Promise<RelayResponse> => {
  console.info(`\n🚀 Initiating gasless transfer for: ${scenarioName}`);

  const relayRequest = {
    jwt,
    permit2Signature,
    ...(permit && { permit }),
  };

  console.info("Relay request includes:", {
    jwt: "✅ JWT token",
    permit2Signature: "✅ Permit2 signature",
    permit: permit ? "✅ Permit2 permit data" : "❌ No permit required",
  });

  const relayResponse = await apiRequest("/gasless-transfer/relay", {
    method: "POST",
    body: JSON.stringify(relayRequest),
  }) as RelayResponse;

  return relayResponse;
};

const runScenario = async (scenario: TestScenario, scenarioNumber: number): Promise<void> => {
  console.info(`\n${"=".repeat(60)}`);
  console.info(`🎯 SCENARIO ${scenarioNumber}: ${scenario.name.toUpperCase()}`);
  console.info(`${"=".repeat(60)}`);

  try {
    const quoteResponse = await requestQuote(scenario);
    const { jwt } = quoteResponse.data;
    const payload = processJwtPayload(jwt, scenario.name);
    const permit2Signature = await signPermit2Data(payload, scenario.name);
    const permit = await createPermitData(payload, scenario.name);
    const relayResponse = await initiateGaslessTransfer(
      jwt,
      permit2Signature,
      permit,
      scenario.name,
    );

    console.info(`\n✅ ${scenario.name} completed successfully!`);
    console.info(`Transaction hash: ${relayResponse.data.hash}`);
  } catch (error) {
    console.error(`\n❌ ${scenario.name} failed:`);
    throw error;
  }
};

const printFinalSummary = (): void => {
  console.info(`\n${"=".repeat(60)}`);
  console.info("🎉 ALL SCENARIOS COMPLETED SUCCESSFULLY");
  console.info(`${"=".repeat(60)}`);
  console.info("✅ Basic gasless transfer (no permit required)");
  console.info("✅ Gasless transfer with permit2 permit");
  console.info("✅ Both JWT flows handled correctly");
  console.info("✅ BigInt deserialization working");
  console.info("✅ Signature generation successful");
  console.info("✅ API integration complete");
  console.info("\n💡 Key differences observed:");
  console.info("- Scenario 1: Simple permit2 signature only");
  console.info("- Scenario 2: Additional permit2 permit data required");
  console.info("- Both scenarios use different corridors (v1 vs v2Direct)");
  console.info("- Different chains and parameters demonstrate API flexibility");
};

const handleError = (error: unknown): void => {
  console.error("\n❌ Example execution failed:");
  if (error instanceof Error) {
    console.error("Error:", error.message);

    if (
      error.message.includes("fetch") ||
      error.message.includes("ECONNREFUSED")
    ) {
      console.error("\n💡 Make sure the back-end service is running:");
      console.error("   yarn workspace @stable-io/back-end run start:dev");
      console.error("Then run this example again");
    } else if (error.message.includes("HTTP 500")) {
      console.error("\n💡 Server error occurred. Check:");
      console.error("- Backend service logs for detailed error information");
      console.error("- Database connection status");
      console.error("- Environment variables configuration");
      console.error("- Signature format and validity");
    } else if (error.message.includes("HTTP 400")) {
      console.error("\n💡 Request validation failed. Verify:");
      console.error("- All parameter formats and types");
      console.error("- Required fields are present and valid");
      console.error("- JWT signature validity");
      console.error("- Permit data structure (if applicable)");
    }
  } else {
    console.error("Unknown error:", error);
  }

  process.exit(1);
};

const main = async (): Promise<void> => {
  try {
    console.info(`Using API URL: ${API_BASE_URL}`);
    console.info("This example will run both gasless transfer scenarios sequentially\n");

    await checkServiceStatus();
    const scenarios = createTestScenarios();

    for (const [index, scenario] of scenarios.entries()) {
      await runScenario(scenario, index + 1);
    }

    printFinalSummary();

  } catch (error) {
    handleError(error);
  }
};

main().catch((error: unknown) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
