// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { AccountRole } from "@solana/kit";
import type { Network } from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress, cctpAccounts } from "@stable-io/cctp-sdk-solana";
import { reclaimRentParamsLayout, transferSurplusSolParamsLayout } from "../layouts.js";
import { type Ix, CctpRBase } from "./base.js";

export class CctpRReclaim<N extends Network> extends CctpRBase<N> {
  //async (though currently not necessary) for consistency and future-proofing
  async composeReclaimRentIx(
    eventDataAddress: SolanaAddress,
    attestation: Uint8Array,
    destinationMessage: Uint8Array | undefined,
  ): Promise<Ix> {
    const { messageTransmitterConfig, messageTransmitter } =
      cctpAccounts[this.network][destinationMessage === undefined ? "v1" : "v2"];

    const accounts = [
      [this.configAddress(),     AccountRole.WRITABLE],
      [messageTransmitterConfig, AccountRole.WRITABLE],
      [eventDataAddress,         AccountRole.WRITABLE],
      [messageTransmitter,       AccountRole.READONLY],
    ] as const;

    const v2DestinationMessage = destinationMessage ?? new Uint8Array();
    const params = { attestation, v2DestinationMessage } as const;
    
    return this.composeIx(accounts, reclaimRentParamsLayout, params);
  }

  async composeTransferSurplusSolIx(): Promise<Ix> {
    const { feeRecipient } = await this.config();
    const accounts = [
      [this.configAddress(), AccountRole.WRITABLE],
      [feeRecipient,         AccountRole.WRITABLE],
    ] as const;

    return this.composeIx(accounts, transferSurplusSolParamsLayout, {});
  }
}
