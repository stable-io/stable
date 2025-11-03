// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { getNetwork } from "./src/env.js";
import { getDeploymentConfig, getProgramIdConfig, setProgramIdConfig } from "./src/deployConfig.js";

function main() {
  const network = getNetwork();
  const config = getDeploymentConfig(network);
  const programIdConfig = getProgramIdConfig();
  const programId = programIdConfig[network];
  if (programId === config.cctpr_program) {
    console.info(`Program ID for ${network} is already set to ${programId}`);
    return;
  }
  console.info("----------------WARNING----------------");
  console.info(`Program ID in config is: ${programId}`);
  console.info(`Setting program ID for ${network} to: ${config.cctpr_program}`);
  console.info("----------------WARNING----------------");
  setProgramIdConfig(network, config.cctpr_program);
}

try {
  main();
} catch (error) {
  console.error(error);
}
