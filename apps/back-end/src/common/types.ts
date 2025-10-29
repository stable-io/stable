// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type {
  Address,
  EvmGasToken,
  Sol,
} from "@stable-io/cctp-sdk-definitions";
import type { Amount } from "@stable-io/amount";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import { SolanaAddress } from "@stable-io/cctp-sdk-solana";

export interface ApiResponseDto<T> {
  readonly data: T;
}

// TODO: REMOVE THIS IN FAVOR OF THE SDK DEFINITIONS
export const supportedEvmDomains = [
  "Ethereum",
  "Avalanche",
  "Optimism",
  "Arbitrum",
  "Base",
  "Polygon",
  "Unichain",
  "Linea",
  "Sonic",
  "Worldchain",
] as const;

export const supportedDomains = [...supportedEvmDomains, "Solana"] as const;

export type SupportedBackendEvmDomain = (typeof supportedEvmDomains)[number];

export type Domain = (typeof supportedDomains)[number];

export type SupportedAddress = EvmAddress | SolanaAddress;
export type SupportedAmount = EvmGasToken | Sol;

// @todo: Probably most things will be serializable as strings, so do this the other way around
type SerializedAsString = Address | Amount<any>;

export type PlainDto<T> = {
  [K in keyof T]: T[K] extends SerializedAsString ? string : T[K];
};

export const networks = ["Testnet", "Mainnet"] as const;
export type Network = (typeof networks)[number];

export interface ParsedSignature {
  v: bigint;
  r: Uint8Array;
  s: Uint8Array;
}
