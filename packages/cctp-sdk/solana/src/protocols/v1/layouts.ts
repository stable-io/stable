// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { DeriveType } from "binary-layout";
import type { Network } from "@stable-io/cctp-sdk-definitions";
import {
  amountItem,
  domainItem,
  universalAddressItem,
  Usdc,
  v1,
} from "@stable-io/cctp-sdk-definitions";
import { littleEndian, vecBytesItem, instructionLayout } from "@stable-io/cctp-sdk-solana";
import { foreignDomains } from "./constants.js";

export const foreignDomainItem = <N extends Network>(network: N) =>
  domainItem(foreignDomains(network));

export const depositForBurnParamsLayout = <N extends Network>(network: N) =>
  instructionLayout("deposit_for_burn", littleEndian([
    { name: "amount",        ...amountItem(8, Usdc)        },
    { name: "destination",   ...foreignDomainItem(network) },
    { name: "mintRecipient", ...universalAddressItem       },
  ]));

export type DepositForBurnParams<N extends Network> =
  DeriveType<ReturnType<typeof depositForBurnParamsLayout<N>>>;

export const receiveMessageParamsLayout =
  instructionLayout("receive_message", littleEndian([
    { name: "message",     ...vecBytesItem(v1.burnMessageLayout()) },
    { name: "attestation", ...vecBytesItem()                       },
  ]));

export type ReceiveMessageParams =
  DeriveType<typeof receiveMessageParamsLayout>;
