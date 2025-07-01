// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import chalk from "chalk";
import {
  cctpGasDropoffName,
  CctpRChainConfig,
  cctprName,
  deployCctpR,
  deployGasDropoff,
  loadCctpGasDropoffAddress,
  loadCctpRAddress,
} from "./src/cctpr.js";
import {
  getChainConfig,
  getOperatingChains,
  init,
  saveDeployments,
  SerializedDeployment,
  toReadable,
} from "./src/common.js";

const processName = "deployCctpR";
init();
const operatingChains = getOperatingChains();

// --------------------------------------------------------------------------------

async function run() {
  console.info(`Start ${processName}!`);

  let failed = false;

  const cctprDeployments = {
    [cctprName]: [] as SerializedDeployment[],
  };
  // Deploy CCTPR to all operating chains where it is missing
  const cctprTasks = await Promise.all(operatingChains.filter(chain =>
    (loadCctpRAddress(chain.chainId) === undefined),
  ).map((chain) => {
    const config = getChainConfig<CctpRChainConfig>(processName, chain.chainId);
    return deployCctpR(chain, config);
  }));
  for (const task of cctprTasks) {
    if ("error" in task) {
      const error = (task.error as any)?.stack || task.error;
      console.info(`Deployment of CCTPR failed in chain ${toReadable(task.chainId)}. Error: ${error}`);
      // There's no need to cancel the rest of the deployment here since this is a leaf deployment.
      failed = true;
    } else {
      console.info(chalk.blue(`Deployed CCTPR to chain ${toReadable(task.chainId)} on address: ${task.address}`));
      cctprDeployments[cctprName].push(task);
    }
  }

  if (cctprDeployments[cctprName].length > 0) {
    saveDeployments(cctprDeployments, processName);
  }

  const cctpGasDropoffDeployments = {
    [cctpGasDropoffName]: [] as SerializedDeployment[],
  };

  // Deploy CCTPR gas dropoff to all operating chains where it is missing
  const dropoffTasks = await Promise.all(operatingChains.filter(chain =>
    (loadCctpGasDropoffAddress(chain.chainId) === undefined),
  ).map((chain) => {
    return deployGasDropoff(chain);
  }));
  for (const task of dropoffTasks) {
    if ("error" in task) {
      const error = (task.error as any)?.stack || task.error;
      console.info(chalk.red(`Deployment of CCTPR Gas Dropoff failed in chain ${toReadable(task.chainId)}.`));
      console.info(`Error: ${error}`);
      // There's no need to cancel the rest of the deployment here since this is a leaf deployment.
      failed = true;
    } else {
      console.info(chalk.blue(`Deployed CCTPR Gas Dropoff to chain ${toReadable(task.chainId)} on address: ${task.address}`));
      cctpGasDropoffDeployments[cctpGasDropoffName].push(task);
    }
  }

  if (cctpGasDropoffDeployments[cctpGasDropoffName].length > 0) {
    saveDeployments(cctpGasDropoffDeployments, processName);
  }

  if (failed) {
    console.error(chalk.red(`Some deployments failed, check logs above.`));
  }
}

// --------------------------------------------------------------------------------

await run();
console.info(chalk.yellow("⚠️ Please add the addresses of the new CCTPR instances to the CCTPR Definitions package. ⚠️"));
