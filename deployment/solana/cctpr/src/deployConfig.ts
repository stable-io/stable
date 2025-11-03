// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { readFileSync, writeFileSync } from "node:fs";
import { Network } from "@stable-io/cctp-sdk-definitions";
import { KeyPairSigner } from "@solana/kit";
import { loadKeypairFromFile } from "./utils.js";

export type DeployAccountType = "cctpr_buffer" | "cctpr_program" | "cctpr_deployer";

export interface DeploymentConfig {
  cctpr_buffer: string;
  cctpr_program: string;
  cctpr_deployer: string;
  cctpr_new_owner?: string;
  cctpr_fee_recipient?: string;
  prioritization_fee?: number;
}

export function readJsonFile(filePath: string): object {
  try {
    const fileContent = readFileSync(filePath, "utf8");
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error reading JSON file: ${error}`);
    throw error;
  }
}

export type ProgramIdConfig = { [key in Network]: string };
export const programIdConfigPath = "../../../contracts/cctpr/solana/programs/cctpr/network.json";

export function getProgramIdConfig(): ProgramIdConfig {
  const config = readJsonFile(programIdConfigPath) as { mainnet: string; testnet: string };
  return { Mainnet: config.mainnet, Testnet: config.testnet };
}

export function setProgramIdConfig(network: Network, programId: string) {
  const config = { ...getProgramIdConfig(), [network]: programId };
  saveJsonFile(programIdConfigPath, { mainnet: config.Mainnet, testnet: config.Testnet });
}

export function getDeploymentFilename(environment: Network): string {
  return `config/${environment}.json`;
}

export function getPrivateKeyFilename(environment: Network, account: DeployAccountType) {
  const config = getDeploymentConfig(environment);
  return `privatekeys/${environment}/${config[account]}.json`;
}

export function saveJsonFile(filePath: string, data: object) {
  writeFileSync(filePath, JSON.stringify(data, undefined, 2));
}

export function getDeploymentConfig(network: Network): DeploymentConfig {
  return readJsonFile(getDeploymentFilename(network)) as DeploymentConfig;
}

export function setDeploymentConfig(network: Network, config: Partial<DeploymentConfig>) {
  const currentConfig = getDeploymentConfig(network);
  saveJsonFile(getDeploymentFilename(network), { ...currentConfig, ...config });
}

export async function loadDeployerKeyPair(network: Network): Promise<KeyPairSigner<string>> {
  const deployerKeyfile = getPrivateKeyFilename(network, "cctpr_deployer");
  return loadKeypairFromFile(deployerKeyfile);
}
