// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { CctpRGovernance } from "@stable-io/cctp-sdk-cctpr-solana";
import { domainsOf, Network, percentage, usdc, wormholeChainIdOf } from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress } from "@stable-io/cctp-sdk-solana";
import { KeyPairSigner } from "@solana/kit";
import { feeAdjustmentTypes } from "@stable-io/cctp-sdk-cctpr-definitions";
import { assertSuccess, createAndSendTx, waitForInput } from "./src/utils.js";
import { chunk } from "@stable-io/map-utils";
import { SolanaKitClient } from "@stable-io/cctp-sdk-solana-kit";
import { getNetwork } from "./src/env.js";
import { getDeploymentConfig, loadDeployerKeyPair } from "./src/deploy_config.js";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";

const feeAdjustments = {
  v1:         { absolute: usdc(0), relative: percentage(100) },
  v2Direct:   { absolute: usdc(0), relative: percentage(100) },
  avaxHop:    { absolute: usdc(0), relative: percentage(100) },
  gasDropoff: { absolute: usdc(0), relative: percentage(100) },
} as const;

async function initializeCctpr(
  network: Network,
  cctprProgramId: SolanaAddress,
  owner: KeyPairSigner,
  newOwner: SolanaAddress,
  feeAdjuster: SolanaAddress,
  feeRecipient: SolanaAddress,
  offChainQuoter: Uint8Array,
) {
  const client = SolanaKitClient.fromNetworkAndDomain(network, "Solana");
  const cctprGovernance = new CctpRGovernance(network, client, {
    cctpr: cctprProgramId,
    oracle: new SolanaAddress(new Uint8Array(32)),
  });

  const initIx = await cctprGovernance.composeInitializeIx(
    new SolanaAddress(owner.address),
    newOwner,
    feeAdjuster,
    feeRecipient,
    offChainQuoter,
  );
  const initTx = await assertSuccess(createAndSendTx(client, [initIx], owner, [owner]));
  console.info("Initialize transaction sent:", initTx);

  const domains = domainsOf("Evm").filter(domain => wormholeChainIdOf(network,domain) !== 0);
  const registerIxs = await Promise.all(
    domains.map(domain => cctprGovernance.composeRegisterChainIx(domain)),
  );

  const registerTx = await assertSuccess(createAndSendTx(client, registerIxs, owner, [owner]));
  console.info("Register transaction sent:", registerTx);

  const updateFeeAdjustmentIxs = await Promise.all(
    feeAdjustmentTypes.map(type => [type, feeAdjustments[type]] as const)
      .flatMap(([corridor, feeAdjustment]) =>
        domains.map(domain =>
          cctprGovernance.composeUpdateFeeAdjustmentIx("owner", domain, corridor, feeAdjustment),
        ),
      ),
  );
  // The instructions are too heavy so we'll do them in chunks of 20
  const feeTxs = await Promise.all(chunk(updateFeeAdjustmentIxs, 20).map(instructions =>
    assertSuccess(createAndSendTx(client, instructions, owner, [owner])),
  ));
  console.info("Update fee adjustments transactions sent:", feeTxs);
}

async function main() {
  const network = getNetwork();
  const config = getDeploymentConfig(network);
  const cctprProgramId = new SolanaAddress(config.cctpr_program);
  const deployer = await loadDeployerKeyPair(network);
  const feeAdjuster = new SolanaAddress(config.cctpr_deployer);
  if (config.cctpr_fee_recipient === undefined) {
    console.error("WARNING: cctpr_fee_recipient is not set in the config, defaulting to cctpr_deployer");
  }
  const feeRecipient = new SolanaAddress(config.cctpr_fee_recipient ?? config.cctpr_deployer);
  const offChainQuoter = new Uint8Array(20);
  if (config.cctpr_new_owner === undefined) {
    console.error("WARNING: cctpr_new_owner is not set in the config, defaulting to cctpr_deployer");
  }
  const newOwner = new SolanaAddress(config.cctpr_new_owner ?? config.cctpr_deployer);

  console.info("Network:", network);
  console.info("CCTPR program:", cctprProgramId.toString());
  console.info("Deployer:", deployer.address);
  console.info("New owner:", newOwner.toString());
  console.info("Fee adjuster:", feeAdjuster.toString());
  console.info("Fee recipient:", feeRecipient.toString());
  console.info("Off chain quoter:", new EvmAddress(offChainQuoter).toString());

  console.info("Type yes to continue");
  const answer = await waitForInput();
  if (answer !== "yes") {
    console.error("Aborting...");
    process.exit(1);
  }

  await initializeCctpr(
    network,
    cctprProgramId,
    deployer,
    newOwner,
    feeAdjuster,
    feeRecipient,
    offChainQuoter,
  );
}

await main();
console.info("Done!");
