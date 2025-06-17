// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import {
  avaxRouterName,
  cctprName,
  deployAvaxRouter,
} from "./src/cctpr.js";
import {
  init,
  saveDeployments,
  SerializedDeployment,
} from "./src/common.js";

const processName = "deployAvaxRouter";
init();

// --------------------------------------------------------------------------------

async function run() {
  console.info(`Start ${processName}!`);
  const avaxRouterDeployments = {
    [avaxRouterName]: [] as SerializedDeployment[],
  };
  const deployment = await deployAvaxRouter();
  if ("error" in deployment) {
    const error = (deployment.error as any)?.stack || deployment.error;
    throw new Error(`Deployment of Avax Router failed. Error: ${error}`);
  }
  avaxRouterDeployments[avaxRouterName].push(deployment);
  console.info(`Avax Router deployed at ${deployment.address}`);
  saveDeployments(avaxRouterDeployments, processName);
}

// --------------------------------------------------------------------------------

await run();
console.info("Done! Please add the address of the Avax Router to the CCTPR Definitions package.");
