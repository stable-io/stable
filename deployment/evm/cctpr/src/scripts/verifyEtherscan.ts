// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import {
  generateCctpRVerifyCommand,
  generateAvaxRouterVerifyCommand,
  generateGasDropoffVerifyCommand,
  type VerificationResult,
  type CctpRConfig,
} from "../helpers/cctpr.js";
import {
  getOperatingChains,
  init,
  loadScriptConfig,
} from "../helpers/common.js";

init();
const operatingChains = getOperatingChains();

function run() {
  console.error("Generating Forge verification commands for CCTPR contracts...");
  console.error(`Operating chains: ${operatingChains.map(c => c.domain).join(", ")}`);
  console.error("");

  const results: VerificationResult[] = [];

  // Generate CctpR verification commands for all operating chains
  for (const chain of operatingChains) {
    const config = loadScriptConfig<CctpRConfig[]>("deployCctpR");
    const chainConfig = config.find(c => c.chainId === chain.chainId);
    if (!chainConfig) {
      throw new Error(`No configuration found for chain ${chain.chainId}`);
    }
    results.push(generateCctpRVerifyCommand(chain, chainConfig));
  }

  // Generate AvaxRouter verification command (only on Avalanche)
  results.push(generateAvaxRouterVerifyCommand());

  // Generate GasDropoff verification commands for all operating chains
  for (const chain of operatingChains) {
    results.push(generateGasDropoffVerifyCommand(chain));
  }

  // Summary
  console.error("Verification Commands Summary:");
  console.error(`Generated: ${results.length} verification commands`);

  console.error("\nForge Verification Commands:");
  console.error("Run these commands from the contracts/cctpr/evm directory:");
  console.error("");

  for (const result of results) {
    console.error(`# ${result.contractName} on ${result.domain} (${result.address})`);
    console.info(result.forgeCommand);
    console.error("");
  }

  console.error("Note: Make sure you have the ETHERSCAN_API_KEY environment variable set before running the commands.");
}

run();
