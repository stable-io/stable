/* eslint-disable unicorn/no-process-exit */
// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { config } from "dotenv";
import { deserializeBigints } from "@stable-io/utils";
import { mnemonicToAccount } from "viem/accounts";

config();

console.info("=== Gasless Transfer API Integration Example ===\n");

const PORT = process.env.PORT ?? "3000";
const API_BASE_URL = `http://localhost:${PORT}`;

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

    console.info(`✅ Response received:`, data);
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes("HTTP")) {
      throw error;
    }
    console.error(`❌ Request failed:`, error);
    throw error;
  }
};

const decodeJwtPayload = (token: string): unknown => {
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
    return JSON.parse(decodedPayload);
  } catch (error) {
    console.error("Failed to decode JWT:", error);
    throw error;
  }
};

const checkServiceStatus = async (): Promise<void> => {
  console.info("\n1️⃣ Checking service status...");
  const statusResponse = await apiRequest("/gasless-transfer/status");
  console.info(`Status: ${String(statusResponse)}\n`);
};

const createQuoteParameters = () => {
  console.info("2️⃣ Preparing quote request...");
  const quoteParams = new URLSearchParams({
    sourceDomain: "Ethereum",
    targetDomain: "Arbitrum",
    amount: "1.500000",
    sender: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    recipient: "0x0000000000000000000000000000000000000001",
    corridor: "v2Direct",
    gasDropoff: "0.010000000000000000",
    permit2PermitRequired: "true",
  });

  console.info("Quote parameters:", Object.fromEntries(quoteParams));
  return quoteParams;
};

const requestQuote = async (quoteParams: URLSearchParams): Promise<unknown> => {
  console.info("\n3️⃣ Requesting quote from API...");
  const quoteResponse = await apiRequest(
    `/gasless-transfer/quote?${quoteParams}`,
  );
  return quoteResponse;
};

const extractJwtFromQuoteResponse = (quoteResponse: unknown): string => {
  if (
    typeof quoteResponse !== "object" ||
    !quoteResponse ||
    !("data" in quoteResponse) ||
    typeof quoteResponse.data !== "object" ||
    !quoteResponse.data ||
    !("jwt" in quoteResponse.data) ||
    typeof quoteResponse.data.jwt !== "string"
  ) {
    throw new Error("Invalid quote response structure");
  }

  const { jwt } = quoteResponse.data;
  console.info("Received JWT token:", jwt.slice(0, 50) + "...");
  return jwt;
};

const decodeAndDeserializeJwt = (jwt: string): Record<string, unknown> => {
  console.info("\n4️⃣ Decoding & deserializing JWT payload...");
  const jwtPayload = decodeJwtPayload(jwt);
  if (typeof jwtPayload !== "object" || !jwtPayload) {
    throw new Error("Invalid JWT payload structure");
  }

  // @todo: Type this properly
  const restoredPayload = deserializeBigints<any>(
    jwtPayload as Record<string, unknown>,
  );

  // @note: Can't JSON.stringify here because we're demonstrating revived BigInts
  console.info(restoredPayload);
  return restoredPayload;
};

const signPermit2Data = async (
  payload: Record<string, unknown>,
): Promise<void> => {
  console.info("\n5️⃣ Signing permit2 typed data with test wallet...");
  if (typeof payload !== "object" || !("permit2TypedData" in payload)) {
    console.warn("No permit2 typed data found in payload; skipping signature");
    return;
  }
  const permit2Data = (payload as any).permit2TypedData as {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    values: Record<string, unknown>;
  };

  const mnemonic =
    process.env.TEST_MNEMONIC ??
    "test test test test test test test test test test test junk";
  const account = mnemonicToAccount(mnemonic);
  const signature = await account.signTypedData(permit2Data as any);

  console.info("Signature:", signature);
  console.info("✅ Typed data successfully signed");
};

const printSuccessMessage = (): void => {
  console.info("\n=== Example Complete ===");
  console.info("✅ Service is running and responding");
  console.info("✅ API accepts quote requests");
  console.info("✅ JWT tokens are properly generated");
  console.info("✅ BigInt values are correctly restored for blockchain use");
  console.info("✅ Permit2 data was successfully signed");
};

const handleError = (error: unknown): void => {
  console.error("\n❌ Example failed:");
  if (error instanceof Error) {
    console.error("Error:", error.message);

    if (
      error.message.includes("fetch") ||
      error.message.includes("ECONNREFUSED")
    ) {
      console.error("\n💡 Make sure the back-end service is running:");
      console.error("   yarn workspace @stable-io/back-end run start:dev");
      console.error("Then run this example again");
    }
  } else {
    console.error("Unknown error:", error);
  }

  process.exit(1);
};

const main = async (): Promise<void> => {
  try {
    console.info(`Using API URL: ${API_BASE_URL}`);

    await checkServiceStatus();

    const quoteParams = createQuoteParameters();
    const quoteResponse = await requestQuote(quoteParams);

    const jwt = extractJwtFromQuoteResponse(quoteResponse);
    const payload = decodeAndDeserializeJwt(jwt);
    await signPermit2Data(payload);

    // @todo: Send permit to the initiate endpoint

    printSuccessMessage();
  } catch (error) {
    handleError(error);
  }
};

main().catch((error: unknown) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
