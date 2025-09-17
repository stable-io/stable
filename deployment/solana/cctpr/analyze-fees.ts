// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { PublicKey } from "@solana/web3.js";
import { 
  DEFAULT_COMPUTE_BUDGET_MICROLAMPORTS,
  getPrioritizationFeeFromList,
  getSortedPrioritizationFeeList,
  PriorityFeePolicy,
} from "./src/fees.js";
import { connection } from "./src/env.js";

async function main() {
  // Parse each command line argument as a public key
  const lockedWritableAccounts = process.argv.slice(2).map((arg) => new PublicKey(arg));
  const sortedList = await getSortedPrioritizationFeeList(connection, lockedWritableAccounts);
  if (sortedList.length === 0) {
    console.log(`\nNo prioritization fees found in recent blocks. Use either `);
    console.log(`   - ${DEFAULT_COMPUTE_BUDGET_MICROLAMPORTS} as minimum recommended value, or `);
    console.log(`   - "analyze-fees <account1> <account2> ..." to analyze specific accounts`);
    return;
  }
  const getFee = (policy: PriorityFeePolicy) => getPrioritizationFeeFromList(sortedList, policy);
  console.log(`Max prioritization fee:                      ${getFee('max')} microLamports`);
  console.log(`High   (95th-percentile) prioritization fee: ${getFee('high')} microLamports`);
  console.log(`Normal (87th-percentile) prioritization fee: ${getFee('normal')} microLamports`);
  console.log(`Low    (50th-percentile) prioritization fee: ${getFee('low')} microLamports`);
}

await main();
console.log('Done!');
