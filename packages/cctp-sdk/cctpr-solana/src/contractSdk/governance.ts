// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { AccountRole } from "@solana/kit";
import type { Network } from "@stable-io/cctp-sdk-definitions";
import { wormholeChainIdOf } from "@stable-io/cctp-sdk-definitions";
import type { FeeAdjustmentType } from "@stable-io/cctp-sdk-cctpr-definitions";
import { SolanaAddress, systemProgramId } from "@stable-io/cctp-sdk-solana";
import type { ForeignDomain } from "./constants.js";
import {
  type FeeAdjustment,
  initializeParamsLayout,
  registerChainParamsLayout,
  deregisterChainParamsLayout,
  updateFeeAdjustmentParamsLayout,
  updateFeeRecipientParamsLayout,
  updateFeeAdjusterParamsLayout,
  updateOffchainQuoterParamsLayout,
  submitOwnerTransferRequestParamsLayout,
  cancelOwnerTransferRequestParamsLayout,
  confirmOwnerTransferRequestParamsLayout,
} from "./layouts.js";
import { type Ix, CctpRBase } from "./base.js";

type BasicEvmAddress = Uint8Array; //TODO: better type

export class CctpRGovernance<N extends Network> extends CctpRBase<N> {
  async composeInitializeIx(
    payer: SolanaAddress,
    owner: SolanaAddress,
    feeAdjuster: SolanaAddress,
    feeRecipient: SolanaAddress,
    offchainQuoter: BasicEvmAddress,
  ): Promise<Ix> {
    const accounts = [
      [payer,                AccountRole.WRITABLE_SIGNER],
      [this.configAddress(), AccountRole.WRITABLE       ],
      [systemProgramId,      AccountRole.READONLY       ],
    ] as const;

    const params = { owner, feeAdjuster, feeRecipient, offchainQuoter } as const;

    return this.composeIx(accounts, initializeParamsLayout, params);
  }

  async composeSubmitOwnerTransferRequestIx(newOwner: SolanaAddress): Promise<Ix> {
    const accounts = await this.ownershipUpdateAccounts("owner");
    return this.composeIx(accounts, submitOwnerTransferRequestParamsLayout, { newOwner });
  }

  async composeCancelOwnerTransferRequestIx(): Promise<Ix> {
    const accounts = await this.ownershipUpdateAccounts("owner");
    return this.composeIx(accounts, cancelOwnerTransferRequestParamsLayout, {});
  }

  async composeConfirmOwnerTransferRequestIx(): Promise<Ix> {
    const accounts = await this.ownershipUpdateAccounts("pendingOwner");
    return this.composeIx(accounts, confirmOwnerTransferRequestParamsLayout, {});
  }

  private async ownershipUpdateAccounts(who: "owner" | "pendingOwner") {
    this.invalidateCachedConfig();
    return [
      [(await this.config())[who], AccountRole.READONLY_SIGNER],
      [this.configAddress(),       AccountRole.READONLY       ],
    ] as const;
  }

  async composeRegisterChainIx(domain: ForeignDomain<N>): Promise<Ix> {
    const accounts = await this.chainRegistrationAccounts(domain);

    const params = {
      domain:        domain as any,
      oracleChainId: wormholeChainIdOf(this.network, domain as any),
    } as const;

    return this.composeIx(accounts, registerChainParamsLayout(this.network), params);
  }

  async composeDeregisterChainIx(domain: ForeignDomain<N>): Promise<Ix> {
    const accounts = await this.chainRegistrationAccounts(domain);

    return this.composeIx(accounts, deregisterChainParamsLayout, {});
  }

  private async chainRegistrationAccounts(domain: ForeignDomain<N>) {
    const { owner } = await this.config();
    const [chainConfig] = this.priceAddresses(domain);
    return [
      [owner,                AccountRole.WRITABLE_SIGNER],
      [this.configAddress(), AccountRole.READONLY       ],
      [chainConfig,          AccountRole.WRITABLE       ],
      [systemProgramId,      AccountRole.READONLY       ],
    ] as const;
  }

  async composeUpdateFeeAdjustmentIx(
    signer: "owner" | "feeAdjuster",
    domain: ForeignDomain<N>,
    adjustmentType: FeeAdjustmentType,
    newFeeAdjustment: FeeAdjustment,
  ): Promise<Ix> {
    const [chainConfig] = this.priceAddresses(domain);
    const accounts = [
      [(await this.config())[signer], AccountRole.READONLY_SIGNER],
      [this.configAddress(),          AccountRole.READONLY       ],
      [chainConfig,                   AccountRole.WRITABLE       ],
    ] as const;

    const params = { adjustmentType, ...newFeeAdjustment } as const;

    return this.composeIx(accounts, updateFeeAdjustmentParamsLayout, params);
  }

  async composeUpdateFeeRecipientIx(newFeeRecipient: SolanaAddress): Promise<Ix> {
    if (newFeeRecipient.equals(SolanaAddress.zeroAddress))
      throw new Error("Invalid fee recipient");

    return this.composeIx(
      await this.roleUpdateAccounts(),
      updateFeeRecipientParamsLayout,
      { newFeeRecipient }
    );
  }

  async composeUpdateFeeAdjusterIx(newFeeAdjuster: SolanaAddress): Promise<Ix> {
    return this.composeIx(
      await this.roleUpdateAccounts(),
      updateFeeAdjusterParamsLayout,
      { newFeeAdjuster }
    );
  }

  async composeUpdateOffchainQuoterIx(newOffchainQuoter: BasicEvmAddress): Promise<Ix> {
    return this.composeIx(
      await this.roleUpdateAccounts(),
      updateOffchainQuoterParamsLayout,
      { newOffchainQuoter }
    );
  }

  private async roleUpdateAccounts() {
    this.invalidateCachedConfig();
    const { owner } = await this.config();
    return [
      [owner,                AccountRole.READONLY_SIGNER],
      [this.configAddress(), AccountRole.READONLY       ],
    ] as const;
  }
}
