// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { TransactionMessage, createSolanaRpc, compileTransaction, Lamports, Address, Base64EncodedDataResponse, Blockhash, Base64EncodedWireTransaction, TransactionMessageWithFeePayer } from "@solana/kit";
import type { Client, DomainsOf, GasTokenOf, Network, Sol } from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress } from "./address.js";
import { RoArray } from "@stable-io/map-utils";

export type TxMsg = TransactionMessage;
export type TxMsgWithFeePayer = TransactionMessage & TransactionMessageWithFeePayer;
export type SignableTx = ReturnType<typeof compileTransaction>;
export type SignableTxMsg = Parameters<typeof compileTransaction>[0];

export type AccountInfo = {
  executable: boolean;
  owner:      SolanaAddress;
  lamports:   Sol;
  data:       Uint8Array;
};

export type BlockHashInfo = {
  blockhash: Blockhash;
  lastValidBlockHeight: bigint;
};

export interface SolanaClient<
  N extends Network = Network,
> extends Client<N, "Solana"> {
  getAccountInfo: (address: SolanaAddress) => Promise<AccountInfo | undefined>;
  getMultipleAccounts: (addresses: RoArray<SolanaAddress>) => Promise<(AccountInfo | undefined)[]>;
  getLatestBlockhash: () => Promise<BlockHashInfo>;
  sendTransaction: (wireTx: Base64EncodedWireTransaction) => Promise<string>;
}
