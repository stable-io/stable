// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { 
  appendTransactionMessageInstructions,
  compileTransaction,
  createSolanaRpc,
  createTransactionMessage,
  GetAccountInfoApi,
  GetLatestBlockhashApi,
  GetMultipleAccountsApi,
  KeyPairSigner,
  pipe,
  Rpc,
  SendTransactionApi,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransaction,
  TransactionMessage,
  TransactionMessageWithFeePayer,
  Base64EncodedWireTransaction,
  getBase64EncodedWireTransaction,
} from "@solana/kit";
import { FailedTransactionMetadata, TransactionMetadata } from "@stable-io/fork-svm";
import { Ix } from "@stable-io/cctp-sdk-cctpr-solana";

export type RpcType = Rpc<GetAccountInfoApi & GetMultipleAccountsApi & SendTransactionApi & GetLatestBlockhashApi>;
export type TxMsg = TransactionMessage & TransactionMessageWithFeePayer;
export type SignableTxMsg = Parameters<typeof compileTransaction>[0];

export class SolanaRpc {
  readonly rpc: RpcType;

  constructor(rpcUrl: string) {
    this.rpc = createSolanaRpc(rpcUrl);
  }

  async addLifetimeAndSendTx(tx: TxMsg, signers: readonly KeyPairSigner[]) {
    const {
      value: { blockhash, lastValidBlockHeight },
    } = await this.rpc.getLatestBlockhash().send();
    const txWithLifetime = setTransactionMessageLifetimeUsingBlockhash(
      { blockhash, lastValidBlockHeight },
      tx
    );
    return this.sendTx(txWithLifetime, signers);
  }
  
  async sendTx(tx: SignableTxMsg, signers: readonly KeyPairSigner[]) {
    const compiledTx = compileTransaction(tx);
    const signedTx = await signTransaction(signers.map(kp => kp.keyPair), compiledTx);
    const wireTx: Base64EncodedWireTransaction = getBase64EncodedWireTransaction(signedTx);
    return this.rpc.sendTransaction(wireTx, { encoding: "base64" }).send();
  }
  
  async createAndSendTx(
    instructions: readonly Ix[],
    feePayer: KeyPairSigner,
    signers: readonly KeyPairSigner[],
  ) {
    return await pipe(
      createTransactionMessage({ version: "legacy" }),
      tx => setTransactionMessageFeePayer(feePayer.address, tx),
      tx => appendTransactionMessageInstructions(instructions, tx),
      tx => this.addLifetimeAndSendTx(tx, signers),
    );
  }
}

export const assertSuccess = async (txResult: Promise<TransactionMetadata>) => {
  try {
    return await txResult;
  }
  catch(error) {
    console.log("tx should succeed but failed with error:\n" +
      (error as FailedTransactionMetadata)?.toString()
    );
    throw error;
  }
};