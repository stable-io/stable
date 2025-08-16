// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ProperLayout, CustomizableBytes, Item } from "binary-layout";
import { customizableBytes } from "binary-layout";
import { amountItem, universalAddressItem, rawDomainItem, domainItem } from "./layoutItems.js";
import { domains } from "./constants/chains/index.js";
import { Usdc } from "./constants/index.js";
//see https://developers.circle.com/stablecoins/message-format

const versionItem = <
  const V extends number,
  const O extends boolean = true,
>(version: V, omit?: O) =>
  ({ binary: "uint", size: 4, custom: version, omit: (omit ?? true) as O } as const);

type DomainItem<R extends boolean> = R extends true
  ? typeof rawDomainItem
  //TODO: Why on god's green earth do I have specify the default type parameter `typeof domains`
  //      here? Without it, types aren't inferred correctly, but I'm at a complete loss as to why.
  : ReturnType<typeof domainItem<typeof domains>>;

const templateDomainItem = <R extends boolean>(rawDomains?: R): DomainItem<R> =>
  (rawDomains ? rawDomainItem : domainItem()) as DomainItem<R>;

export const messageLayoutTemplate = <
  const V extends number,
  const N extends Item,
  const E extends ProperLayout,
  const B extends CustomizableBytes = undefined,
  const R extends boolean = false,
  const O extends boolean = true,
>(
  version: V,
  nonceItem: N,
  extraFields: E,
  messageBody?: B,
  useRawDomains?: R,
  omitVersion?: O,
) => [
  { name: "version",           ...versionItem(version, omitVersion) },
  { name: "sourceDomain",      ...templateDomainItem(useRawDomains) },
  { name: "destinationDomain", ...templateDomainItem(useRawDomains) },
  { name: "nonce",             ...nonceItem                         },
  { name: "sender",            ...universalAddressItem              },
  { name: "recipient",         ...universalAddressItem              },
  { name: "destinationCaller", ...universalAddressItem              },
  ...extraFields,
  customizableBytes({ name: "messageBody" }, messageBody),
] as const; //deliberately no `satisfies` declaration because it messes up type inference

export const burnMessageLayoutTemplate = <
  const V extends number,
  const O extends boolean = true,
>(version: V, omitVersion?: O) => [
  { name: "messageBodyVersion", ...versionItem(version, omitVersion) },
  { name: "burnToken",          ...universalAddressItem              },
  { name: "mintRecipient",      ...universalAddressItem              },
  { name: "amount",             ...amountItem(32, Usdc)              },
  { name: "messageSender",      ...universalAddressItem              },
] as const; //deliberately no `satisfies` declaration because it messes up type inference
