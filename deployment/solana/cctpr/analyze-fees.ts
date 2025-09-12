// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { PublicKey } from '@solana/web3.js';
import { DEFAULT_COMPUTE_BUDGET_MICROLAMPORTS, getPrioritizationFeeFromList, getSortedPrioritizationFeeList } from './src/fees.js';
import { connection } from './src/env.js';

async function main() {

  // parse each command line argument as a public key
  const lockedWritableAccounts = process.argv.slice(2).map((arg) => new PublicKey(arg));
  const sortedPrioritizationFeeList = await getSortedPrioritizationFeeList(connection, lockedWritableAccounts);
  if (sortedPrioritizationFeeList.length === 0) {
    console.log(`\nNo prioritization fees found in recent blocks. Use either \n   - ${DEFAULT_COMPUTE_BUDGET_MICROLAMPORTS} as minimum recommended value, or \n   - "analyze-fees <account1> <account2> ..." to analyze specific accounts`);
    return;
  }

  console.log(`Max prioritization fee:                      ${getPrioritizationFeeFromList(sortedPrioritizationFeeList, 'max')} microLamports`);
  console.log(`High   (95th-percentile) prioritization fee: ${getPrioritizationFeeFromList(sortedPrioritizationFeeList, 'high')} microLamports`);
  console.log(`Normal (87th-percentile) prioritization fee: ${getPrioritizationFeeFromList(sortedPrioritizationFeeList, 'normal')} microLamports`);
  console.log(`Low    (50th-percentile) prioritization fee: ${getPrioritizationFeeFromList(sortedPrioritizationFeeList, 'low')} microLamports`);
}

await main();
console.log('Done!');
