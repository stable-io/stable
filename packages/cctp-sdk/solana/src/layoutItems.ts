// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type {
  NumberSize,
  CustomizableBytes,
  CustomConversion,
  Item,
  Layout,
  ProperLayout,
  DeriveType,
  Endianness,
} from "binary-layout";
import { customizableBytes, boolItem, enumItem, setEndianness } from "binary-layout";
import { valueIndexEntries } from "@stable-io/map-utils";
import { KindWithAtomic } from "@stable-io/amount";
import { paddingItem, amountItem, hashItem, Sol, sol } from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress } from "./address.js";
import { type DiscriminatorType, discriminatorOf } from "./utils.js";

//explicitly tell tsc that setEndianness turns ProperLayouts into ProperLayouts
//  (we need this invariant/guarantee elsewhere)
type SetEndianness<L extends Layout, E extends Endianness> =
  ReturnType<typeof setEndianness<L, E>> extends infer R
  ? L extends ProperLayout
    ? R extends ProperLayout
      ? R
      : never
    : R
  : never;

export const littleEndian = <const L extends Layout>(layout: L) =>
  setEndianness(layout, "little");

export const bumpItem = { binary: "uint", size: 1 } as const satisfies Item;

export const solanaAddressItem = {
  binary: "bytes",
  size: SolanaAddress.byteSize,
  custom: {
    to: (encoded: Uint8Array) => new SolanaAddress(encoded),
    from: (addr: SolanaAddress) => addr.toUint8Array(),
  } satisfies CustomConversion<Uint8Array, SolanaAddress>,
} as const satisfies Item;

export const vecBytesItem = <const P extends CustomizableBytes>(spec?: P) =>
  customizableBytes({ lengthSize: 4, lengthEndianness: "little" }, spec);

export const vecArrayItem = <const L extends Layout>(layout: L) =>
  ({ binary: "array", lengthSize: 4, lengthEndianness: "little", layout } as const);

const discriminatorItem = (type: DiscriminatorType, name: string) => ({
  name: "discriminator",
  binary: "bytes",
  custom: discriminatorOf(type, name),
  omit: true,
} as const);

const discriminatedLayout = <const L extends ProperLayout>(
  type: DiscriminatorType,
  name: string,
  layout: L,
) => [discriminatorItem(type, name), ...layout] as const;

//can't use bind here because it doesn't preserve the const generic
export const accountLayout =
  <const L extends ProperLayout>(name: string, layout: L) =>
    discriminatedLayout("account", name, layout);

export const instructionLayout =
  <const L extends ProperLayout>(name: string, layout: L) =>
    discriminatedLayout("instruction", name, layout);

export const eventLayout =
  <const L extends ProperLayout>(name: string, layout: L) =>
    discriminatedLayout("event", name, layout);

export const cEnumItem = <const E extends readonly string[]>(names: E, size: NumberSize = 1) =>
  enumItem(valueIndexEntries(names), { size });

// named after https://docs.rs/solana-program-option/latest/solana_program_option/enum.COption.html
const baseCOptionLayout = <const L extends Layout>(layout: L) => [
  { name: "padding", ...paddingItem(3)       },
  { name: "isSome",  ...boolItem()           },
  { name: "value",   binary: "bytes", layout },
] as const;
type BaseCOptionLayout<L extends Layout> = DeriveType<ReturnType<typeof baseCOptionLayout<L>>>;

export const cOptionItem = <const L extends Layout>(layout: L, defaultValue: DeriveType<L>) => ({
  binary: "bytes",
  layout: baseCOptionLayout(layout),
  custom: {
    to: (obj: BaseCOptionLayout<L>) =>
      obj.isSome ? obj.value : undefined,
    from: (value: DeriveType<L> | undefined) =>
      value === undefined ? { isSome: false, value: defaultValue } : { isSome: true, value },
  },
} as const);

export const cOptionAddressItem = cOptionItem(solanaAddressItem, SolanaAddress.zeroAddress);

export const mintAccountLayout = <const K extends KindWithAtomic>(kind: K) => littleEndian([
  { name: "mintAuthority",   ...cOptionAddressItem   },
  { name: "supply",          ...amountItem(8, kind)  },
  { name: "decimals",        binary: "uint", size: 1 },
  { name: "isInitialized",   ...boolItem()           },
  { name: "freezeAuthority", ...cOptionAddressItem   },
]);

const initStates = ["Uninitialized", "Initialized"] as const;

const tokenStates = [...initStates, "Frozen"] as const;
export const tokenAccountLayout = <const K extends KindWithAtomic>(kind: K) => littleEndian([
  { name: "mint",            ...solanaAddressItem                       },
  { name: "owner",           ...solanaAddressItem                       },
  { name: "amount",          ...amountItem(8, kind)                     },
  { name: "delegate",        ...cOptionAddressItem                      },
  { name: "state",           ...cEnumItem(tokenStates)                  },
  { name: "isNative",        ...cOptionItem(amountItem(8, Sol), sol(0)) },
  { name: "delegatedAmount", ...amountItem(8, kind)                     },
  { name: "closeAuthority",  ...cOptionAddressItem                      },
]);

//see https://github.com/solana-program/system/blob/main/clients/js/src/generated/accounts/nonce.ts
const nonceVersion = ["Legacy", "Current"] as const;
export const durableNonceAccountLayout = littleEndian([
  { name: "version",         ...cEnumItem(nonceVersion, 4) },
  { name: "state",           ...cEnumItem(initStates,   4) },
  { name: "authority",       ...solanaAddressItem          },
  { name: "blockhash",       ...hashItem                   },
  { name: "solPerSignature", ...amountItem(8, Sol)         },
]);
