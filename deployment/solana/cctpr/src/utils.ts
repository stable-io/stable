// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import {
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createTransactionMessage,
  GetAccountInfoApi,
  GetLatestBlockhashApi,
  GetMultipleAccountsApi,
  KeyPairSigner,
  pipe,
  Rpc,
  SendTransactionApi,
  setTransactionMessageFeePayer,
} from "@solana/kit";
import { addLifetimeAndSendTx, Ix, SolanaClient } from "@stable-io/cctp-sdk-solana";
import { FailedTransactionMetadata, TransactionMetadata } from "@stable-io/fork-svm";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type RpcType = Rpc<
  GetAccountInfoApi & GetMultipleAccountsApi & SendTransactionApi & GetLatestBlockhashApi
>;

export async function createAndSendTx(
  client: SolanaClient,
  instructions: readonly Ix[],
  feePayer: KeyPairSigner,
  signers: readonly KeyPairSigner[],
) {
  return await pipe(
    createTransactionMessage({ version: "legacy" }),
    tx => setTransactionMessageFeePayer(feePayer.address, tx),
    tx => appendTransactionMessageInstructions(instructions, tx),
    tx => addLifetimeAndSendTx(client, tx, signers),
  );
}

export const assertSuccess = async (txResult: Promise<TransactionMetadata>) => {
  try {
    return await txResult;
  }
  catch (error) {
    const message = (error as FailedTransactionMetadata)?.toString();
    console.error(`tx should succeed but failed with error:\n${message}`);
    throw error;
  }
};

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

export async function waitForInput(): Promise<string> {
  return new Promise(resolve => {
      process.stdin.resume();
      process.stdin.once("data", (data) => {
          process.stdin.pause();
          resolve(data.toString().trim());
      });
  });
}