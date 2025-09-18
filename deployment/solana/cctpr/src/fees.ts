// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Connection, PublicKey, RecentPrioritizationFees } from "@solana/web3.js";

export const DEFAULT_COMPUTE_BUDGET_MICROLAMPORTS = 100000;
export type PriorityFeePolicy = "max" | "high" | "normal" | "low";

/**
 * Get the prioritization fee in microlamports from the network using a given policy.
 * If no prioritization fee is found, return the default fee.
 *
 * @param connection - The connection to the network.
 * @param lockedWritableAccounts - The locked writable accounts.
 * @param priorityFeePolicy - The policy to use to get the prioritization fee.
 * @param defaultFee - The default fee to return if no prioritization fee is found.
 * @returns The prioritization fee.
 */
export async function getPrioritizationFee(connection: Connection,
  lockedWritableAccounts: PublicKey[],
  priorityFeePolicy: PriorityFeePolicy,
  defaultFee: number = DEFAULT_COMPUTE_BUDGET_MICROLAMPORTS,
): Promise<number> {
  const sortedFeeList = await getSortedPrioritizationFeeList(
    connection, lockedWritableAccounts,
  );
  if (sortedFeeList.length === 0) {
    return defaultFee;
  }
  return getPrioritizationFeeFromList(sortedFeeList, priorityFeePolicy);
}

/**
 * Get the sorted prioritization fee list, in ascending order.
 * @param connection - The connection to the network.
 * @param lockedWritableAccounts - The locked writable accounts.
 * @returns The sorted prioritization fee list.
 */
export async function getSortedPrioritizationFeeList(
  connection: Connection,
  lockedWritableAccounts: PublicKey[],
): Promise<RecentPrioritizationFees[]> {
  const feeConfig = {
    lockedWritableAccounts: lockedWritableAccounts,
  };
  const fees = await connection.getRecentPrioritizationFees(feeConfig);
  const nonZeroFees = fees.filter(entry => entry.prioritizationFee > 0);
  return nonZeroFees.sort((a, b) => a.prioritizationFee - b.prioritizationFee);
}

/**
 * Get the prioritization fee from a sorted list of prioritization fees and a given policy.
 * @param sortedPrioritizationFeeList - The sorted prioritization fee list, in ascending order.
 * @param priorityFeePolicy - The policy to use to get the prioritization fee.
 * @returns The prioritization fee.
 */
export function getPrioritizationFeeFromList(
  sortedPrioritizationFeeList: RecentPrioritizationFees[],
  priorityFeePolicy: PriorityFeePolicy,
): number {
  if (sortedPrioritizationFeeList.length === 0) {
    throw new Error("Prioritization fee list is empty");
  }
  const getFee = (index: number) => sortedPrioritizationFeeList[index]!.prioritizationFee;
  switch (priorityFeePolicy) {
    case "max":
      return getFee(sortedPrioritizationFeeList.length - 1);
    case "high":
      return getFee(Math.floor(sortedPrioritizationFeeList.length * 0.95));
    case "normal":
      return getFee(Math.floor(sortedPrioritizationFeeList.length * 0.87));
    case "low":
      return getFee(Math.floor(sortedPrioritizationFeeList.length * 0.5));
    default:
      throw new Error(`
        Invalid priorityFeePolicy: ${priorityFeePolicy} must be one of: max, high, normal, low`,
      );
  }
}
