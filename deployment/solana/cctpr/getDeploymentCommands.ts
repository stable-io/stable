// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Network } from "@stable-io/cctp-sdk-definitions";
import { getNetwork, getRpcUrl } from "./src/env.js";
import {
  DeploymentConfig,
  getDeploymentConfig,
  getPrivateKeyFilename,
  getProgramIdConfig,
} from "./src/deployConfig.js";

function generateCommands(network: Network, config: DeploymentConfig): string[] {
  const rpcUrl = getRpcUrl(network);
  const programPath = `./build-program/${network}/cctpr.so`;
  const deployerKeyfile = getPrivateKeyFilename(network, "cctpr_deployer");
  const bufferKeyfile = getPrivateKeyFilename(network, "cctpr_buffer");
  const programKeyfile = getPrivateKeyFilename(network, "cctpr_program");
  const prioritizationFee = config.prioritization_fee;
  if (prioritizationFee === undefined) {
    throw new Error("Prioritization fee is not set, run analyzeFees.ts first");
  }
  const programId = getProgramIdConfig()[network];
  if (programId !== config.cctpr_program) {
    throw new Error(`Program ID mismatch: ${programId} !== ${config.cctpr_program}`);
  }
  const write_buffer_command = `solana program write-buffer ${programPath}`
    .concat(` -k "${deployerKeyfile}"`)
    .concat(` --buffer "${bufferKeyfile}"`)
    .concat(` --with-compute-unit-price "${prioritizationFee}"`)
    .concat(` --url ${rpcUrl} `);

  const deploy_program_command = `solana program deploy`
    .concat(` -k "${deployerKeyfile}"`)
    .concat(` --buffer "${bufferKeyfile}"`)
    .concat(` --program-id "${programKeyfile}"`)
    .concat(` --with-compute-unit-price "${prioritizationFee}"`)
    .concat(` --url ${rpcUrl}`)
    .concat(` --final`);

  return [write_buffer_command, deploy_program_command];
}

function main() {
  const network = getNetwork();
  const config = getDeploymentConfig(network);
  const commands = generateCommands(network, config);

  console.info(`# Deployment commands for ${network}`);
  console.info(commands.join("\n"));
}

try {
  main();
} catch (error) {
  console.error(error);
}
