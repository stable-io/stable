// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import {
  fetchCctpRDeployment,
  fetchAvaxRouterDeployment,
  fetchGasDropoffDeployment,
  type BytecodeVerificationResult,
  type CctpRConfig,
  cctprName,
  avaxRouterName,
  cctpGasDropoffName,
} from "../helpers/cctpr.js";
import {
  getOperatingChains,
  init,
  loadScriptConfig,
} from "../helpers/common.js";

init();
const operatingChains = getOperatingChains();

async function run() {
  console.error("Verifying bytecode using viem for CCTPR contracts...");
  console.error(`Operating chains: ${operatingChains.map(c => c.domain).join(", ")}`);
  console.error("");

  const results: BytecodeVerificationResult[] = [];

  for (const chain of operatingChains) {
    const config = loadScriptConfig<CctpRConfig[]>("deployCctpR");
    const chainConfig = config.find(c => c.chainId === chain.chainId);
    if (!chainConfig) {
      console.error(`No configuration found for chain ${chain.chainId}`);
      continue;
    }

    try {
      const result = await fetchCctpRDeployment(chain, chainConfig);
      results.push(result);
    } catch (error) {
      results.push({
        domain: chain.domain,
        contractName: cctprName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const avaxResult = await fetchAvaxRouterDeployment();
    results.push(avaxResult);
  } catch (error) {
    results.push({
      domain: "Avalanche",
      contractName: avaxRouterName,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  for (const chain of operatingChains) {
    try {
      const result = await fetchGasDropoffDeployment(chain);
      results.push(result);
    } catch (error) {
      results.push({
        domain: chain.domain,
        contractName: cctpGasDropoffName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.error("Bytecode Verification Summary:");
  console.error(`Verified: ${results.length} contracts`);

  console.error("\nVerification Results:");
  console.error("");

  const senderAddresses = new Set<string>();
  const ownerAddresses = new Set<string>();
  const totalCount = results.length;
  let verifiedCount = 0;
  let ownerMatchesCount = 0;
  for (const result of results) {
    console.error(`# ${result.contractName} on ${result.domain}`);
    if ("address" in result) {
      console.error(`Address: ${result.address}`);
      console.error(`Transaction: ${result.txId}`);
    }
    if ("error" in result) {
      console.error(`ERROR: ${result.error}`);
    } else {
      const expectedAddress = result.expectedAddress.toString();
      const actualAddress = result.actualAddress.toString();
      if (actualAddress === expectedAddress) {
        if (result.actualBytecode === result.expectedBytecode) {
          verifiedCount++;
          const bytecodeLength = result.actualBytecode.length / 2 - 1;
          console.error(`Contract address: ${actualAddress}`);
          console.error(`SUCCESS: BYTECODE MATCHES (${bytecodeLength} bytes)`);
        } else {
          console.error(`ERROR: BYTECODE MISMATCH`);
          console.error(`Expected: ${result.expectedBytecode}`);
          console.error(`Actual:   ${result.actualBytecode}`);
        }
      } else {
        console.error(`ERROR: CONTRACT ADDRESS MISMATCH`);
        console.error(`Expected: ${expectedAddress}`);
        console.error(`Actual:   ${actualAddress}`);
      }
      const owner = result.owner?.toString();
      const sender = result.sender.toString();
      if (owner === sender) {
        ownerMatchesCount++;
        console.error(`OWNER MATCHES, POTENTIAL SECURITY ISSUE`);
        console.error(`Owner/Sender: ${owner}`);
      }
      senderAddresses.add(sender);
      if (owner) {
        ownerAddresses.add(owner);
      }
    }
    console.error("");
  }

  console.error(`Sender addresses: ${Array.from(senderAddresses).join(", ")}`);
  console.error(`Owner addresses: ${Array.from(ownerAddresses).join(", ")}`);
  console.error(`Overall: ${verifiedCount}/${totalCount} contracts verified`);

  if (verifiedCount === totalCount) {
    console.error("All contracts verified successfully!");
  } else {
    console.error("Some contracts FAILED verification");
  }
  if (ownerMatchesCount > 0) {
    console.error(`WARNING: ${ownerMatchesCount} contracts have the same owner and sender address`);
    console.error("This is a potential security issue if the sender was compromised");
  }
}

await run();
