// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Address } from "@stable-io/cctp-sdk-definitions";
import { UniversalAddress } from "@stable-io/cctp-sdk-definitions";
import type { Text, Size } from "@stable-io/utils";
import { encoding, isUint8Array } from "@stable-io/utils";
import { isAddress, getAddress } from "viem/utils"; // TODO: Remove this dependency?

export type RawAddress = `0x${string}`;

export type EvmAddressish = string | Uint8Array | UniversalAddress | EvmAddress;

export class EvmAddress implements Address {
  static readonly byteSize = 20 as Size;
  static readonly zeroAddress = new EvmAddress(new Uint8Array(EvmAddress.byteSize));

  static isValidAddress(address: string): boolean {
    return isAddress(address);
  }

  private readonly address: RawAddress; //stored as checksum address

  constructor(address: EvmAddressish) {
    this.address = (() => {
      if (typeof address === "string") {
        if (!EvmAddress.isValidAddress(address))
          throw EvmAddress.invalid(
            address,
            `expected ${EvmAddress.byteSize}-byte hex string` as Text,
          );

        return getAddress(address);
      }

      if (isUint8Array(address)) {
        const hexStr = encoding.hex.encode(address, true);
        if (address.length !== EvmAddress.byteSize)
          throw EvmAddress.invalid(hexStr, `expected ${EvmAddress.byteSize} bytes` as Text);

        return getAddress(hexStr);
      }

      if (address instanceof UniversalAddress) {
        const bytes = address.unwrap();
        const zeroPrefixSize = UniversalAddress.byteSize - EvmAddress.byteSize;
        if (bytes.subarray(0, zeroPrefixSize).some(byte => byte !== 0))
          throw EvmAddress.invalid(encoding.hex.encode(bytes), `prefix is not zero` as Text);

        return getAddress(encoding.hex.encode(bytes.subarray(zeroPrefixSize), true));
      }

      return address.address;
    })();
  }

  unwrap(): RawAddress {
    return this.address;
  }

  toString(): RawAddress {
    return this.address;
  }

  toUint8Array(): Uint8Array {
    return encoding.hex.decode(this.address);
  }

  toUniversalAddress(): UniversalAddress {
    return new UniversalAddress(this.address, "Evm");
  }

  equals(other: EvmAddress): boolean {
    return this.address === other.address;
  }

  private static invalid(address: string, cause: Text) {
    return new Error(`Invalid Evm address ${address}: ${cause}`);
  }
}
