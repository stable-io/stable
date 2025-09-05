// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { CustomizableBytes, ProperLayout, DeriveType, Item } from "binary-layout";
import { customizableBytes } from "binary-layout";
import { messageLayoutTemplate, burnMessageLayoutTemplate } from "../../messages.js";
import { uint256Item, hashItem, amountItem } from "../../layoutItems.js";
import { Usdc } from "../../constants/index.js";

export const finalityThresholdItem = { binary: "uint", size: 4 } as const satisfies Item;

const extraFields = [
  { name: "minFinalityThreshold",      ...finalityThresholdItem },
  { name: "finalityThresholdExecuted", ...finalityThresholdItem },
] as const satisfies ProperLayout;

export const messageLayout = <
  const B extends CustomizableBytes = undefined,
  R extends boolean = false,
>(messageBody?: B, useRawDomains?: R) =>
  messageLayoutTemplate(1, hashItem, extraFields, messageBody, useRawDomains);

export type Message<
  B extends CustomizableBytes = undefined,
  R extends boolean = false,
> = DeriveType<ReturnType<typeof messageLayout<B, R>>>;

export const burnMessageBodyLayout = <
  const H extends CustomizableBytes = undefined,
>(hookData?: H) => [
  ...burnMessageLayoutTemplate(1),
  { name: "maxFee",          ...amountItem(32, Usdc) },
  { name: "feeExecuted",     ...amountItem(32, Usdc) },
  { name: "expirationBlock", ...uint256Item          },
  customizableBytes({ name: "hookData" }, hookData),
] as const;

export type BurnMessageBody<
  H extends CustomizableBytes = undefined,
> = DeriveType<ReturnType<typeof burnMessageBodyLayout<H>>>;

export const burnMessageLayout = <
  const H extends CustomizableBytes = undefined,
  R extends boolean = false,
>(hookData?: H, useRawDomains?: R) =>
  messageLayout(burnMessageBodyLayout(hookData), useRawDomains);

export type BurnMessage<
  H extends CustomizableBytes = undefined,
  R extends boolean = false,
> = DeriveType<ReturnType<typeof burnMessageLayout<H, R>>>;
