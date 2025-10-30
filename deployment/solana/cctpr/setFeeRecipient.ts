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
import { getNetwork } from "./src/env.js";
import { getDeploymentConfig, loadDeployerKeyPair } from "./src/deployConfig.js";

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
  console.info("Set Fee recipient transaction sent:", feeTx);
}

async function main() {
  const network = getNetwork();
  const config = getDeploymentConfig(network);
  const cctprProgramId = new SolanaAddress(config.cctpr_program);
  const deployer = await loadDeployerKeyPair(network);
  if (config.cctpr_fee_recipient === undefined) {
    console.error("ERROR: cctpr_fee_recipient is not set in the config");
    return;
  }
  const feeRecipient = new SolanaAddress(config.cctpr_fee_recipient);
  await setFeeRecipient(
    network,
    cctprProgramId,
    deployer,
    feeRecipient,
  );
  console.info("Done!");
}

await main();
