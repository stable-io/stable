// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import { SolanaAddress } from "@stable-io/cctp-sdk-solana";

const BLOCKED_DURATION = 10000; // 10 seconds in milliseconds

export type NonceAccount = {
  address: SolanaAddress;
  blockedUntil: number;
};

@Injectable()
export class NonceAccountService {

  private readonly logger = new Logger(NonceAccountService.name);
  private readonly nonceAccounts: NonceAccount[] = [];
  private lastAvailableIndex = 0;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.nonceAccounts = this.configService.nonceAccounts.map(
      address => ({ address, blockedUntil: 0 })
    );
  }

  private getNonceAccount(address: SolanaAddress): NonceAccount {
    const nonceAccount = this.nonceAccounts.find(nonce => nonce.address.equals(address));
    if (!nonceAccount) {
      this.logger.error("Nonce account not found");
      throw new Error("Nonce account not found");
    }
    return nonceAccount;
  }

  private getNextAvailableAccount(): NonceAccount | undefined {
    for (let i = 0; i < this.nonceAccounts.length; i++) {
      const index = (this.lastAvailableIndex + i) % this.nonceAccounts.length;
      const nonceAccount = this.nonceAccounts[index]!;
      if (nonceAccount.blockedUntil < Date.now()) {
        this.lastAvailableIndex = index;
        return nonceAccount;
      }
    }
    return undefined;
  }

  public getAvailableNonceAccount(): SolanaAddress {
    const nonceAccount = this.getNextAvailableAccount();
    if (!nonceAccount) {
      this.logger.error("No nonce accounts are available");
      throw new Error("No nonce accounts are available");
    }
    return nonceAccount.address;
  }

  public blockNonceAccount(address: SolanaAddress): void {
    const nonceAccount = this.getNonceAccount(address);
    nonceAccount.blockedUntil = Date.now() + BLOCKED_DURATION;
  }

  public unblockNonceAccount(address: SolanaAddress): void {
    const nonceAccount = this.getNonceAccount(address);
    nonceAccount.blockedUntil = 0;
  }
}
