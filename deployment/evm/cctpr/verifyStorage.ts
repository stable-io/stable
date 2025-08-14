// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import {
  type CctpRConfig,
  loadFeeAdjustments,
  adjustmentEquals,
  loadCctpRAddress,
} from "./src/cctpr.js";
import {
  getOperatingChains,
  init,
  loadScriptConfig,
  getNetwork,
  getViemClient,
} from "./src/common.js";
import {
  CctpRGovernance,
  extraDomains,
  FeeAdjustment,
  feeAdjustmentTypes,
  type FeeAdjustments,
  type FeeAdjustmentType,
} from "@stable-io/cctp-sdk-cctpr-evm";
import { wormholeChainIdOf } from "@stable-io/cctp-sdk-definitions";

init();
const operatingChains = getOperatingChains();

type StorageVerificationResult = {
  domain: string;
} & (
  | {
      error: string;
    }
  | {
      address: EvmAddress;
      expectedAddress: EvmAddress;
      owner: EvmAddress;
      expectedOwner: EvmAddress;
      feeAdjuster: EvmAddress;
      expectedFeeAdjuster: EvmAddress;
      feeRecipient: EvmAddress;
      expectedFeeRecipient: EvmAddress;
      offChainQuoter: EvmAddress;
      expectedOffChainQuoter: EvmAddress;
      feeAdjustments: Record<FeeAdjustmentType, Partial<FeeAdjustments>>;
      expectedFeeAdjustments: Record<FeeAdjustmentType, Partial<FeeAdjustments>>;
      chainIds: Record<string, number>;
      expectedChainIds: Record<string, number>;
    }
);

async function run() {
  console.error("Verifying CCTPR contract storage state using CCTPR SDK...");
  console.error(`Operating chains: ${operatingChains.map(c => c.domain).join(", ")}`);
  console.error("");

  const results: StorageVerificationResult[] = [];

  for (const chain of operatingChains) {
    const config = loadScriptConfig<CctpRConfig[]>("deployCctpR");
    const chainConfig = config.find(c => c.chainId === chain.chainId);
    if (!chainConfig) {
      console.error(`No configuration found for chain ${chain.chainId}`);
      continue;
    }

    try {
      const result = await fetchCctpRStorage(chain, chainConfig);
      results.push(result);
    } catch (error) {
      results.push({
        domain: chain.domain,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.error("Storage Verification Summary:");
  console.error(`Verified: ${results.length} contracts`);

  console.error("\nVerification Results:");
  console.error("");

  const totalCount = results.length;
  let verifiedCount = 0;
  let rolesMatchCount = 0;
  let feeAdjustmentsMatchCount = 0;
  let chainIdsMatchCount = 0;

  for (const result of results) {
    console.error(`# CCTPR on ${result.domain}`);
    
    if ("error" in result) {
      console.error(`ERROR: ${result.error}`);
    } else {
      const addressMatch = result.address.toString() === result.expectedAddress.toString();
      if (addressMatch) {
        console.error(`Address: ${result.address}`);
      } else {
        console.error(`Address MISMATCH`);
        console.error(`Expected Address: ${result.expectedAddress.toString()}`);
        console.error(`Actual Address: ${result.address.toString()}`);
      }

      // Check if all roles match expected values
      const rolesMatch = 
        result.owner.toString() === result.expectedOwner.toString() &&
        result.feeAdjuster.toString() === result.expectedFeeAdjuster.toString() &&
        result.feeRecipient.toString() === result.expectedFeeRecipient.toString() &&
        result.offChainQuoter.toString() === result.expectedOffChainQuoter.toString();

      if (rolesMatch) {
        rolesMatchCount++;
        console.error(`Owner: ${result.owner}`);
        console.error(`Fee Adjuster: ${result.feeAdjuster}`);
        console.error(`Fee Recipient: ${result.feeRecipient}`);
        console.error(`Off-Chain Quoter: ${result.offChainQuoter}`);
      } else {
        const roleError = (name: string, expected: EvmAddress, actual: EvmAddress) => {
          console.error(`  ${name}: Expected ${expected.toString()}, Got ${actual.toString()}`);
        };
        console.error(`ROLES DO NOT MATCH EXPECTED VALUES`);
        console.error("Expected vs Actual:");
        roleError("Owner", result.expectedOwner, result.owner);
        roleError("Fee Adjuster", result.expectedFeeAdjuster, result.feeAdjuster);
        roleError("Fee Recipient", result.expectedFeeRecipient, result.feeRecipient);
        roleError("Off-Chain Quoter", result.expectedOffChainQuoter, result.offChainQuoter);
      }

      // Check if fee adjustments match
      const feeAdjustmentsMatch = compareFeeAdjustments(
        result.feeAdjustments,
        result.expectedFeeAdjustments,
      );

      if (feeAdjustmentsMatch) {
        feeAdjustmentsMatchCount++;
      } else {
        console.error(`FEE ADJUSTMENTS MISMATCH`);
        for (const [type, adjustments] of Object.entries(result.expectedFeeAdjustments)) {
          const actualAdjustments = result.feeAdjustments[type as FeeAdjustmentType];
          console.error(`  ${type}:`);
          for (const [domain, expected] of Object.entries(adjustments)) {
            const actual = actualAdjustments?.[domain];
            if (actual === undefined) {
              console.error(`    ${domain}: No adjustment found`);
            } else if (!adjustmentEquals(expected, actual)) {
              const feeError = (domain: string, actual: FeeAdjustment, expected: FeeAdjustment) => {
                console.error(`    ${domain}:`);
                console.error(`      Expected: ${expected.relativePercent}% + ${expected.absoluteUsdc} USDC`);
                console.error(`      Actual: ${actual.relativePercent}% + ${actual.absoluteUsdc} USDC`);
              }
              feeError(domain, actual, expected);
            }
          }
        }
      }

      // Check if chain IDs match
      const chainIdsMatch = compareChainIds(result.chainIds, result.expectedChainIds);

      if (chainIdsMatch) {
        chainIdsMatchCount++;
        console.error(`REGISTERED CHAIN IDS MATCH`);
      } else {
        console.error(`REGISTERED CHAIN IDS MISMATCH`);
        console.error("Expected vs Actual:");
        
        for (const [domain, expectedChainId] of Object.entries(result.expectedChainIds)) {
          const actualChainId = result.chainIds[domain];
          if (expectedChainId !== actualChainId) {
            console.error(`  ${domain}: Expected ${expectedChainId}, Got ${actualChainId}`);
          }
        }
      }

      if (addressMatch && rolesMatch && feeAdjustmentsMatch && chainIdsMatch) {
        verifiedCount++;
      }
    }
    console.error("");
  }

  console.error(`Overall: ${verifiedCount}/${totalCount} contracts fully verified`);
  console.error(`Fee Adjustments Match: ${feeAdjustmentsMatchCount}/${totalCount} contracts`);
  console.error(`Registered Chain IDs Match: ${chainIdsMatchCount}/${totalCount} contracts`);
  console.error(`Roles Match Expected Values: ${rolesMatchCount}/${totalCount} contracts`);

  if (verifiedCount === totalCount) {
    console.error("All contracts verified successfully!");
  } else {
    console.error("Some contracts FAILED verification");
  }
}

async function fetchCctpRStorage(
  chain: any,
  configParameters: CctpRConfig,
): Promise<StorageVerificationResult> {
  const network = getNetwork();
  const viemClient = getViemClient(network, chain);
  const cctpR = new CctpRGovernance(viemClient);
  const deployedAddress = loadCctpRAddress(chain.chainId);
  if (deployedAddress === undefined) {
    throw new Error(`Chain ${chain.chainId} does not have a CCTPR deployment.`);
  }
  const expectedAddress = new EvmAddress(deployedAddress);
  // Get actual storage values
  const [owner, feeAdjuster, feeRecipient, offChainQuoter] = await Promise.all([
    cctpR.getRole("owner"),
    cctpR.getRole("feeAdjuster"),
    cctpR.getRole("feeRecipient"),
    cctpR.getRole("offChainQuoter"),
  ]);
  const [expectedOwner, expectedFeeAdjuster, expectedFeeRecipient, expectedOffChainQuoter] = [
    new EvmAddress(configParameters.owner),
    new EvmAddress(configParameters.feeAdjuster),
    new EvmAddress(configParameters.feeRecipient),
    new EvmAddress(configParameters.offChainQuoter),
  ];

  const actualFeeAdjustmentsArray = await Promise.all(
    feeAdjustmentTypes.map(type => cctpR.getFeeAdjustments(type))
  );
  const feeAdjustments = Object.fromEntries(
    feeAdjustmentTypes.map((type, index) => [type, actualFeeAdjustmentsArray[index]])
  ) as Record<FeeAdjustmentType, Partial<FeeAdjustments>>;
  const expectedFeeAdjustments = loadFeeAdjustments();

  const chainIds = await cctpR.getRegisteredChainId();
  const expectedChainIds: Record<string, number> = {};
  for (const domain of extraDomains(network)) {
    const chainId = wormholeChainIdOf(network, domain);
    if (chainId !== undefined) {
      expectedChainIds[domain] = chainId;
    }
  }

  return {
    domain: chain.domain,
    address: cctpR.address,
    expectedAddress,
    owner,
    expectedOwner,
    feeAdjuster,
    expectedFeeAdjuster,
    feeRecipient,
    expectedFeeRecipient,
    offChainQuoter,
    expectedOffChainQuoter,
    feeAdjustments,
    expectedFeeAdjustments,
    chainIds,
    expectedChainIds,
  };
}

function compareFeeAdjustments(
  actual: Record<FeeAdjustmentType, Partial<FeeAdjustments>>,
  expected: Record<FeeAdjustmentType, Partial<FeeAdjustments>>,
): boolean {
  for (const [type, expectedAdjustments] of Object.entries(expected)) {
    const actualAdjustments = actual[type as FeeAdjustmentType];
    for (const [domain, expectedAdjustment] of Object.entries(expectedAdjustments)) {
      const actualAdjustment = actualAdjustments?.[domain];
      if (!actualAdjustment) {
        return false;
      }
      if (!adjustmentEquals(expectedAdjustment, actualAdjustment)) {
        return false;
      }
    }
  }
  return true;
}

function compareChainIds(
  actual: Record<string, number>,
  expected: Record<string, number>,
): boolean {
  for (const [domain, expectedChainId] of Object.entries(expected)) {
    const actualChainId = actual[domain];
    if (actualChainId === undefined || actualChainId !== expectedChainId) {
      return false;
    }
  }
  return true;
}

await run(); 