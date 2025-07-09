// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { CustomizableBytes, CustomConversion, Item, ProperLayout } from "binary-layout";
import { customizableBytes } from "binary-layout";
import { SolanaAddress } from "./address.js";
import { type DiscriminatorType, discriminatorOf } from "./utils.js";

export const bumpItem = { binary: "uint", size: 1 } as const satisfies Item;

export const solanaAddressItem = {
  binary: "bytes",
  size: SolanaAddress.byteSize,
  custom: {
    to: (encoded: Uint8Array) => new SolanaAddress(encoded),
    from: (addr: SolanaAddress) => addr.toUint8Array(),
  } satisfies CustomConversion<Uint8Array, SolanaAddress>,
} as const satisfies Item;

export const vecItem = <const P extends CustomizableBytes>(spec?: P) =>
  customizableBytes({ lengthSize: 4, lengthEndianness: "little" }, spec);

const discriminatorItem = (type: DiscriminatorType, name: string) => ({
  name: "discriminator",
  binary: "bytes",
  custom: discriminatorOf(type, name),
  omit: true,
} as const);

const discriminatedLayout = <const L extends ProperLayout>(
  type: DiscriminatorType,
  name: string,
  layout: L
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
