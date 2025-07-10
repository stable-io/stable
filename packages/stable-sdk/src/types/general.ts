// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { EvmDomains } from "@stable-io/cctp-sdk-definitions";

export type { Network } from "@stable-io/cctp-sdk-definitions";

export type Hex = `0x${string}`;
export type EvmChains = keyof EvmDomains;

/** @todo */
// Amount is expressed in human units, with an optional decimal point
// i.e. "1.545" for an USDC amount is 1545 miliUSDC, "2" is 2000 miliUSDC
export type Amount = string;
export type Chain = string;
export type Address = string;
export type UnsignedMessage = string;
export type UnsignedTx = string;
export type TxHash = string;
