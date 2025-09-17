// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { CctpRGovernance } from "@stable-io/cctp-sdk-cctpr-solana";
import { Network } from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress } from "@stable-io/cctp-sdk-solana";
import { KeyPairSigner } from "@solana/kit";
import { assertSuccess, createAndSendTx } from "./src/utils.js";
import { SolanaKitClient } from "@stable-io/cctp-sdk-solana-kit";
import { loadOwnerKeypair } from "./src/env.js";

async function setFeeRecipient(
  network: Network,
  cctprProgramId: SolanaAddress,
  owner: KeyPairSigner,
  feeRecipient: SolanaAddress,
) {
  const solanaClient = SolanaKitClient.fromNetworkAndDomain(network, "Solana");
  const cctprGovernance = new CctpRGovernance(network, solanaClient, {
    cctpr: cctprProgramId,
    oracle: new SolanaAddress(new Uint8Array(32)),
  });

  const updateIx = await cctprGovernance.composeUpdateFeeRecipientIx(feeRecipient);
  const feeTx = await assertSuccess(createAndSendTx(solanaClient, [updateIx], owner, [owner]));
  console.log("Set Fee recipient transaction sent:", feeTx);
}

async function main() {
  const cctprProgramId = new SolanaAddress("CcTPR7jH6T3T5nWmi6bPfoUqd77sWakbTczBzvaLrksM");
  const feeRecipient = new SolanaAddress("AdAVF5KmmGmpNQhjY7FL96wZLEynD6Mx3VXJTZf2yFps");
  const owner = await loadOwnerKeypair();
  
  await setFeeRecipient(
    "Testnet",
    cctprProgramId,
    owner,
    feeRecipient,
  );
}

await main();
console.log('Done!');
