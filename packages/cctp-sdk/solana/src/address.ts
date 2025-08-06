// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Address } from "@stable-io/cctp-sdk-definitions";
import { UniversalAddress } from "@stable-io/cctp-sdk-definitions";
import type { Text } from "@stable-io/utils";
import { encoding, isUint8Array } from "@stable-io/utils";
import type { Address as SolanaNativeAddress } from "@solana/kit";

export type SolanaAddressish =
  string | SolanaNativeAddress | Uint8Array | UniversalAddress | SolanaAddress;

export class SolanaAddress implements Address {
  static readonly byteSize = 32;
  static readonly zeroAddress = new SolanaAddress(new Uint8Array(SolanaAddress.byteSize));

  static isValidAddress(address: string): address is SolanaNativeAddress {
    try {
      return address.length >= 32 && address.length <= 44 &&
        encoding.base58.decode(address).length === SolanaAddress.byteSize;
    } catch {
      return false;
    }
  }

  private readonly address: SolanaNativeAddress;

  constructor(address: SolanaAddressish) {
    this.address = (() => {
      if (typeof address === "string") {
        if (!SolanaAddress.isValidAddress(address))
          throw SolanaAddress.invalid(
            address,
            `expected ${SolanaAddress.byteSize} bytes base58-encoded address` as Text,
          );

        return address;
      }

      if (isUint8Array(address)) {
        const b58Str = encoding.base58.encode(address);
        if (address.length !== SolanaAddress.byteSize)
          throw SolanaAddress.invalid(b58Str, `expected ${SolanaAddress.byteSize} bytes` as Text);

        return b58Str as SolanaNativeAddress;
      }

      if (address instanceof UniversalAddress)
        return encoding.base58.encode(address.unwrap()) as SolanaNativeAddress;

      return address.address;
    })();
  }

  unwrap(): SolanaNativeAddress {
    return this.address;
  }

  toString(): string {
    return this.address;
  }

  toUint8Array(): Uint8Array {
    return encoding.base58.decode(this.address);
  }

  toUniversalAddress(): UniversalAddress {
    return new UniversalAddress(this.address, "Solana");
  }

  equals(other: SolanaAddress): boolean {
    return this.address === other.address;
  }

  private static invalid(address: string, cause: Text) {
    return new Error(`Invalid Solana address ${address}: ${cause}`);
  }
}
