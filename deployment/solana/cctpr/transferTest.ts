// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { CctpR } from "@stable-io/cctp-sdk-cctpr-solana";
import { avax, genericGasToken, Network, percentage, Sol, sol, usdc } from "@stable-io/cctp-sdk-definitions";
import { addLifetimeAndSendTx, SolanaAddress } from "@stable-io/cctp-sdk-solana";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import { createKeyPairSignerFromBytes, KeyPairSigner } from "@solana/kit";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Conversion } from "@stable-io/amount";
import { assertSuccess } from "./src/utils.js";
import { SolanaKitClient } from "@stable-io/cctp-sdk-solana-kit";
import { getDeploymentConfig, loadDeployerKeyPair } from "./src/deployConfig.js";
import { getNetwork } from "./src/env.js";

async function transfer(
  network: Network,
  cctprProgramId: SolanaAddress,
  user: KeyPairSigner,
  dest: EvmAddress,
) {
  const client = SolanaKitClient.fromNetworkAndDomain(network, "Solana");
  const cctpr = new CctpR(network, client, { cctpr: cctprProgramId });

  const mode = "usdc" as string;
  const amount = usdc("0.1");
  const fastFeeRate = percentage(5, "bp");
  const solPrice = Conversion.from(usdc(0.1), Sol);
  const corridorParams = { type: "v2Direct", fastFeeRate };
  const gasDropoff = genericGasToken(0.01);
  const relayFeeUsdc = usdc("0.1", "human");
  const relayFeeSol = sol("10", "human");
  const rentRebate = cctpr.cctpMessageRentCost("v2Direct");
  const exactRelayFee = mode === "gas"
    ? relayFeeSol.sub(rentRebate)
    : relayFeeUsdc.sub(rentRebate.convert(solPrice));
  const maxRelayFee = exactRelayFee;
  const quoteVariant = { type: "onChain", maxRelayFee } as const;
  const destinationDomain = "Avalanche";
  // const queries = [{ destinationDomain, corridor: "v2Direct", gasDropoff }] as const;

  const sharedTransferArgs = [
    destinationDomain,
    { amount, type: "in" },
    dest.toUniversalAddress(),
    avax(gasDropoff.toUnit("human")),
    corridorParams as any,
    quoteVariant,
    new SolanaAddress(user.address),
  ] as const;

  const tx = await assertSuccess(addLifetimeAndSendTx(client, {
    ...(await cctpr.transferWithRelay(...sharedTransferArgs)),
    version: "legacy",
  }, [user]));
  console.info("Transfer transaction sent:", tx);
}

export async function loadKeypairFromFile(
  filePath: string,
): Promise<KeyPairSigner<string>> {
  const resolvedPath = path.resolve(
    filePath.startsWith("~") ? filePath.replace("~", os.homedir()) : filePath,
  );
  const loadedKeyBytes = Uint8Array.from(
    JSON.parse(fs.readFileSync(resolvedPath, "utf8")),
  );
  return createKeyPairSignerFromBytes(loadedKeyBytes);
}

async function main() {
  const network = getNetwork();
  const config = getDeploymentConfig(network);
  const cctprProgramId = new SolanaAddress(config.cctpr_program);
  const deployer = await loadDeployerKeyPair(network);
  const dest = new EvmAddress("0x6862bE596a57E92c9FEB36f95582F6409d9B6cf9");

  await transfer(
    network,
    cctprProgramId,
    deployer,
    dest,
  );
}

await main();
console.info("Done!");
