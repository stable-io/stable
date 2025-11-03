// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type {
  TransactionMessage,
  compileTransaction,
  Blockhash,
  Base64EncodedWireTransaction,
  TransactionMessageWithFeePayer,
  TransactionWithLifetime,
  GetTransactionApi,
  Signature,
  Slot,
} from "@solana/kit";
import type { Client, Network, Sol } from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress } from "./address.js";
import { RoArray } from "@stable-io/map-utils";

export type TxMsg = TransactionMessage;
export type TxMsgWithFeePayer = TransactionMessage & TransactionMessageWithFeePayer;
export type SignableTx = ReturnType<typeof compileTransaction>;
export type TxWithLifetime = Parameters<typeof compileTransaction>[0] & TransactionWithLifetime;
export type ConfirmedTx = NonNullable<ReturnType<
  Extract<
    GetTransactionApi["getTransaction"],
    (signature: Signature, config: { encoding: "json" }) => any
  >
>>;

export type AccountInfo = {
  executable: boolean;
  owner:      SolanaAddress;
  lamports:   Sol;
  data:       Uint8Array;
};

export type BlockHashInfo = {
  slot: Slot;
  blockhash: Blockhash;
  lastValidBlockHeight: bigint;
};

export type GetSignaturesConfig = (Readonly<{
  before?: Signature;
  until?: Signature;
  commitment?: "confirmed" | "finalized";
  limit?: number;
  minContextSlot?: Slot;
}>);

export interface SolanaClient<
  N extends Network = Network,
> extends Client<N, "Solana"> {
  getAccountInfo: (address: SolanaAddress) => Promise<AccountInfo | undefined>;
  getMultipleAccounts: (addresses: RoArray<SolanaAddress>) => Promise<(AccountInfo | undefined)[]>;
  getLatestBlockhash: () => Promise<BlockHashInfo>;
  sendTransaction: (wireTx: Base64EncodedWireTransaction) => Promise<string>;
  getSignaturesForAddress: (
    address: SolanaAddress,
    config?: GetSignaturesConfig,
  ) => Promise<Signature[]>;
  getTransaction: (signature: Signature) => Promise<ConfirmedTx | undefined>;
}
