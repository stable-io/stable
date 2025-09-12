// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { mapTo } from "@stable-io/map-utils";
import { Byte, byte, sol } from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress } from "./address.js";
import { Conversion } from "@stable-io/amount";

export const [
  systemProgramId,
  bpfLoaderUpgradeableProgramId,
  computeBudgetProgramId,
  tokenProgramId,
  token2022ProgramId,
  associatedTokenProgramId,
] = mapTo([
  "11111111111111111111111111111111",
  "BPFLoaderUpgradeab1e11111111111111111111111",
  "ComputeBudget111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
])(address => new SolanaAddress(address));

export const emptyAccountSize = byte(128);
export const rentCost = Conversion.from(sol(6_960, "lamports"), Byte);
