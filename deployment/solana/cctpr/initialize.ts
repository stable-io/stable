// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { CctpRGovernance } from "@stable-io/cctp-sdk-cctpr-solana";
import { domainsOf, Network, percentage, usdc } from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress } from "@stable-io/cctp-sdk-solana";
import { createKeyPairSignerFromBytes, KeyPairSigner } from "@solana/kit";
import { feeAdjustmentTypes } from "@stable-io/cctp-sdk-cctpr-definitions";
import { assertSuccess, SolanaRpc } from "./src/rpc.js";
import fs from "fs";
import path from "path";
import os from "os";
import process from "process";
import { chunk } from "@stable-io/map-utils";

const feeAdjustments = {
  v1:         { absolute: usdc(0), relative: percentage(100) },
  v2Direct:   { absolute: usdc(0), relative: percentage(100) },
  avaxHop:    { absolute: usdc(0), relative: percentage(100) },
  gasDropoff: { absolute: usdc(0), relative: percentage(100) },
} as const;

async function initializeCctpr(
  network: Network,
  rpcUrl: string,
  cctprProgramId: SolanaAddress,
  owner: KeyPairSigner,
  newOwner: SolanaAddress,
  feeAdjuster: SolanaAddress,
  feeRecipient: SolanaAddress,
  offChainQuoter: Uint8Array,
) {
  const rpc = new SolanaRpc(rpcUrl);
  const cctprGovernance = new CctpRGovernance(network, rpc.rpc, {
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
  const initTx = await assertSuccess(rpc.createAndSendTx([initIx], owner, [owner]));
  console.log("Initialize transaction sent:", initTx);

  const domains = domainsOf("Evm");
  const registerIxs = await Promise.all(
    domains.map(domain => cctprGovernance.composeRegisterChainIx(domain))
  );

  const registerTx = await assertSuccess(rpc.createAndSendTx(registerIxs, owner, [owner]));
  console.log("Register transaction sent:", registerTx);

  const updateFeeAdjustmentIxs = await Promise.all(
    feeAdjustmentTypes.map(type => [type, feeAdjustments[type]] as const)
      .flatMap(([corridor, feeAdjustment]) =>
        domains.map(domain =>
          cctprGovernance.composeUpdateFeeAdjustmentIx("owner", domain, corridor, feeAdjustment)
        )
      )
  );
  // The instructions are too heavy so we'll do them in chunks of 24
  const txs = await Promise.all(chunk(updateFeeAdjustmentIxs, 24).map(instructions =>
    assertSuccess(rpc.createAndSendTx(instructions, owner, [owner]))
  ));
  console.log("Update fee adjustments transactions sent:", txs);
}

export async function loadKeypairFromFile(
  filePath: string
): Promise<KeyPairSigner<string>> {
  const resolvedPath = path.resolve(
    filePath.startsWith("~") ? filePath.replace("~", os.homedir()) : filePath
  );
  const loadedKeyBytes = Uint8Array.from(
    JSON.parse(fs.readFileSync(resolvedPath, "utf8"))
  );
  return createKeyPairSignerFromBytes(loadedKeyBytes);
}

async function main() {
  const rpcUrl = "https://api.devnet.solana.com";
  const cctprProgramId = new SolanaAddress("CcTPR7jH6T3T5nWmi6bPfoUqd77sWakbTczBzvaLrksM");
  const cctprOwner = new SolanaAddress("tMPpewA8FGoqDh8RqvVH1rZERCjBD7V7BSCmDn7bkxs");
  const feeAdjuster = new SolanaAddress("tMPpewA8FGoqDh8RqvVH1rZERCjBD7V7BSCmDn7bkxs");
  const feeRecipient = new SolanaAddress("CvsvkFX4xpr92uJbCiez91Keqpp9UNpAfY7nD3TChVg");
  const offChainQuoter = new Uint8Array(20);
  const ownerKeyFile = process.env["OWNER_WALLET_FILE"];
  if (ownerKeyFile === undefined) {
    throw new Error("ENV variable OWNER_WALLET_FILE not set")
  }
  const owner = await loadKeypairFromFile(ownerKeyFile)

  await initializeCctpr(
    "Testnet",
    rpcUrl,
    cctprProgramId,
    owner,
    cctprOwner,
    feeAdjuster,
    feeRecipient,
    offChainQuoter
  );
}

await main();
console.log('Done!');
