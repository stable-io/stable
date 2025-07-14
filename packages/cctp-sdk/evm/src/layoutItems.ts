// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Size } from "@stable-io/utils";
import type { Layout, DeriveType, CustomConversion, Item } from "binary-layout";
import { calcStaticSize } from "binary-layout";
import { signatureItem, uint256Item } from "@stable-io/cctp-sdk-definitions";
import { EvmAddress } from "./address.js";
import { selectorOf } from "./utils.js";

export const wordSize = 32 as Size;

export const selectorItem = (funcSig: string) => ({
  name: "selector",
  binary: "bytes",
  custom: selectorOf(funcSig),
  omit: true,
} as const);

export const evmAddressItem = {
  binary: "bytes",
  size: EvmAddress.byteSize,
  custom: {
    to: (encoded: Uint8Array) => new EvmAddress(encoded),
    from: (addr: EvmAddress) => addr.toUint8Array(),
  } satisfies CustomConversion<Uint8Array, EvmAddress>,
} as const satisfies Item;

export const permitItem = {
  binary: "bytes", layout: [
    { name: "value",     ...uint256Item   },
    { name: "deadline",  ...uint256Item   },
    { name: "signature", ...signatureItem },
  ],
} as const satisfies Item;
export type Permit = DeriveType<typeof permitItem>;

export const paddedSlotItem = <const I extends Item>(item: I) => ({
  binary: "bytes", layout: [
    { name: "padding",
      binary: "bytes",
      custom: new Uint8Array(wordSize - calcStaticSize(item)!),
      omit: true,
    },
    { name: "item", ...item },
  ],
  custom: {
    to: (raw: { item: DeriveType<I> }) => raw.item,
    from: (item: DeriveType<I>) => ({ item }),
  },
} as const);

//poor man's abi.encode/decode(bytes)
const lengthSize = 4;
export const abiEncodedBytesItem = <const L extends Layout | undefined = undefined>(
  opts?: { layout?: L; position?: number },
) => ({
  binary: "bytes",
  layout: [
    { name: "offset", ...uint256Item,
      custom: BigInt(((opts?.position ?? 0) + 1) * wordSize), omit: true,
    },
    { name: "lengthPadding", binary: "bytes",
      custom: new Uint8Array(wordSize - lengthSize), omit: true,
    },
    { name: "item", binary: "bytes",
      lengthSize, layout: opts?.layout as L,
    },
    { name: "postPadding", binary: "bytes" },
  ],
  custom: {
    //we drop postPadding (without checking) when deserializing and skip it on serialization
    to: (wrapped: { item: L extends Layout ? DeriveType<L> : Uint8Array }) => wrapped.item,
    from: (item: L extends Layout ? DeriveType<L> : Uint8Array) =>
      ({ item, postPadding: new Uint8Array(0) }),
  },
} as const);
