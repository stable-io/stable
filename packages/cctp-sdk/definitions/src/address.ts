// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Size } from "@stable-io/utils";
import { encoding, isUint8Array } from "@stable-io/utils";
import type { PlatformRegistry, RegisteredPlatform, LoadedDomain, ToPlatform } from "./registry.js";
import type { Platform, PlatformOf, Domain } from "./constants/chains/index.js";
import { platformOf, addressFormatOf } from "./constants/chains/platforms.js";

export interface AddressSubclass<T extends Address> {
  readonly zeroAddress: T;
  readonly byteSize: Size;
}

export interface Address {
  //can't define static properties in an interface, but
  //  all Address implementations are expected to satisfy AddressSubclass

  //unwrap returns the underlying address type, e.g.:
  //  * a Uint8Array for UniversalAddress
  //  * a checksum hex string string for Evm
  //  * a PublicKey for Solana
  //  * etc.
  unwrap(): unknown;
  toString(): string;
  toUint8Array(): Uint8Array;
  toUniversalAddress(): UniversalAddress;
  //as well as:
  //equals(other: UniversalAddress | SpecificAddress): boolean;
}

export type PlatformAddress<P extends RegisteredPlatform> = PlatformRegistry[P]["Address"];

export type UniversalAddressish = string | Uint8Array | UniversalAddress;

export class UniversalAddress implements Address {
  static readonly byteSize = 32 as Size;
  static readonly zeroAddress = new UniversalAddress(new Uint8Array(UniversalAddress.byteSize));
  private static decodeFunc = {
    hex:    encoding.hex.decode,
    base58: encoding.base58.decode,
    bech32: encoding.bech32.decode,
  } as const;

  private readonly address: Uint8Array;

  constructor(address: string, platform?: Platform);
  constructor(address: Uint8Array | UniversalAddress);
  constructor(address: UniversalAddressish, platform?: Platform) {
    this.address = (() => {
      if (typeof address === "string") {
        const [size, format] = platform ? addressFormatOf(platform) : [32, "hex"] as const;
        //assert(size <= UniversalAddress.byteSize);
        const decoded = UniversalAddress.decodeFunc[format](address);

        if (decoded.length !== size)
          throw new Error(`${address} has invalid length of ${decoded.length} for ${platform}`);

        return decoded.length < UniversalAddress.byteSize
          ? encoding.bytes.zpad(decoded, UniversalAddress.byteSize)
          : decoded;
      }

      if (isUint8Array(address)) {
        if (address.length !== UniversalAddress.byteSize)
          throw new Error(`UniversalAddresses must be ${UniversalAddress.byteSize} bytes long`);

        return address;
      }

      return address.address;
    })();
  }

  toPlatformAddress<const T extends LoadedDomain | RegisteredPlatform>(
    chainOrPlatform: T,
  ): PlatformAddress<ToPlatform<T>> {
    return platformAddress(chainOrPlatform, this);
  }

  unwrap(): Uint8Array {
    return this.address;
  }

  toString(): `0x${string}` {
    return encoding.hex.encode(this.address, true);
  }

  toUint8Array(): Uint8Array {
    return this.address;
  }

  toUniversalAddress(): this {
    return this;
  }

  toJSON(): string {
    return this.toString();
  }

  equals(other: UniversalAddress): boolean {
    return encoding.bytes.equals(this.address, other.address);
  }
}
UniversalAddress satisfies AddressSubclass<UniversalAddress>;

export type UniversalOrNative<T extends Domain | Platform> = UniversalAddress |
  (T extends LoadedDomain | RegisteredPlatform ? PlatformAddress<ToPlatform<T>> : never);

export type DomainAddress<
  D extends LoadedDomain,
  A extends UniversalOrNative<PlatformOf<D>>,
> = {
  readonly domain: D;
  readonly address: A;
};

export type PlatformAddressCtr = new (ua: UniversalAddress | string | Uint8Array) => Address;
const platformAddrFactory = new Map<Platform, PlatformAddressCtr>();

export function registerPlatformAddress<const P extends Platform>(
  platform: P,
  ctr: PlatformAddressCtr,
): void {
  if (platformAddrFactory.has(platform))
    throw new Error(`Address type for platform ${platform} has already been registered`);

  platformAddrFactory.set(platform, ctr);
}

export function platformAddress<const T extends LoadedDomain | RegisteredPlatform>(
  domainOrPlatform: T,
  address: string | Uint8Array | UniversalAddress,
): PlatformAddress<ToPlatform<T>> {
  const platform = platformOf.get(domainOrPlatform) ?? domainOrPlatform as Platform;
  const addrCtr = platformAddrFactory.get(platform)!;
  return new addrCtr(address) as unknown as PlatformAddress<ToPlatform<T>>;
}
