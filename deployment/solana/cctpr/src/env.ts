// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Connection, Commitment } from "@solana/web3.js";
import { loadKeypairFromFile } from "./utils.js";
import { KeyPairSigner } from "@solana/kit";

export function getEnv(key: string): string {
  const envVarValue = process.env[key];
  if (!envVarValue) {
    throw new Error(`${key} not found on environment`);
  }

  return envVarValue;
}

export const rpcUrl = getEnv("SOLANA_RPC_URL");

export const connectionCommitmentLevel = (
  process.env["solana_commitment"] || "confirmed"
) as Commitment;

export const connection = new Connection(rpcUrl, connectionCommitmentLevel);

export async function loadOwnerKeypair(): Promise<KeyPairSigner<string>> {
  return loadKeypairFromFile(getEnv("OWNER_WALLET_FILE"));
}