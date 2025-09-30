// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { loadKeypairFromFile } from "./utils.js";
import { KeyPairSigner } from "@solana/kit";
import { Network } from "@stable-io/cctp-sdk-definitions";

export function getEnv(key: string): string {
  const envVarValue = process.env[key];
  if (!envVarValue) {
    throw new Error(`${key} not found on environment`);
  }

  return envVarValue;
}

export function getNetwork(): Network {
  const network = getEnv("ENV").toUpperCase();
  switch (network) {
    case "MAINNET":
      return "Mainnet";
    case "TESTNET":
      return "Testnet";
    default:
      throw new Error(`ENV variable should be either "MAINNET" or "TESTNET"`);
  }
}

export function getRpcUrl(network: Network): string {
  switch (network) {
    case "Mainnet":
      return "https://api.mainnet-beta.solana.com";
    case "Testnet":
      return "https://api.devnet.solana.com";
  }
}