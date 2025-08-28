// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { TransactionMessage, createSolanaRpc, compileTransaction } from "@solana/kit";
import type { Sol } from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress } from "./address.js";

export type SolanaClient = ReturnType<typeof createSolanaRpc>;

export type TxMsg = TransactionMessage;
export type SignableTx = ReturnType<typeof compileTransaction>;

export type AccountInfo = {
  executable: boolean;
  owner:      SolanaAddress;
  lamports:   Sol;
  data:       Uint8Array;
};
