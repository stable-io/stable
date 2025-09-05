// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { DeepReadonly } from "@stable-io/map-utils";
import type { Brand, BrandedSubArray } from "@stable-io/utils";
import type { Client, DomainsOf, EvmGasToken, GasTokenOf, Network } from "@stable-io/cctp-sdk-definitions";
import { type RawAddress, EvmAddress } from "./address.js";

export type CallData    = Brand<BrandedSubArray<CallData>,    "CallData"   >;
export type ReturnData  = Brand<BrandedSubArray<ReturnData>,  "ReturnData" >;
export type StorageData = Brand<BrandedSubArray<StorageData>, "StorageData">;

export type AccessList = {
  address:     EvmAddress;
  storageKeys: bigint[];
}[];

export interface BaseTx {
  to?:         EvmAddress;
  from?:       EvmAddress;
  value?:      EvmGasToken;
  data?:       CallData;
  accessList?: AccessList;
}

export interface ReadCall extends BaseTx {
  to:     EvmAddress;
  value?: EvmGasToken;
  data:   CallData;
}

export interface ContractTx extends BaseTx {
  to:     EvmAddress;
  value?: EvmGasToken;
  data:   CallData;
}

export interface ValueTx extends BaseTx {
  value: EvmGasToken;
}

export interface ContractValueTx extends BaseTx {
  to:    EvmAddress;
  value: EvmGasToken;
  data:  CallData;
}

export type Eip712Domain = Readonly<{
  name?:              string;
  version?:           string;
  chainId?:           bigint;
  verifyingContract?: RawAddress;
  salt?:              RawAddress;
}>;

export type Eip712Data<Message = Record<string, unknown>> = Readonly<{
  types:       Record<string, Readonly<{ name: string; type: string }>[]>;
  primaryType: string;
  domain:      Eip712Domain;
  message:     DeepReadonly<Message>;
}>;

export type Eip2612Message = Readonly<{
  owner:    RawAddress;
  spender:  RawAddress;
  value:    bigint;
  nonce:    bigint;
  deadline: bigint;
}>;

export type Eip2612Data = Eip712Data<Eip2612Message>;

export type Permit2TokenPermissions = Readonly<{
  token:  RawAddress;
  amount: bigint;
}>;

export type Permit2TransferFromMessage = Readonly<{
  permitted: Permit2TokenPermissions;
  nonce:     bigint;
  deadline:  bigint;
}>;

export type Permit2TransferFromData = Eip712Data<Permit2TransferFromMessage>;

export type Permit2WitnessTransferFromMessage<Witness> =
  Permit2TransferFromMessage &
  { readonly spender: RawAddress } &
  DeepReadonly<Witness>;

export type Permit2WitnessTransferFromData<Witness> =
  Eip712Data<Permit2WitnessTransferFromMessage<Witness>>;

export interface EvmClient<
  N extends Network = Network,
  D extends DomainsOf<"Evm"> = DomainsOf<"Evm">,
> extends Client<N, "Evm", D> {
  estimateGas:    (tx: BaseTx) => Promise<bigint>;
  ethCall:        (tx: ContractTx) => Promise<Uint8Array>;
  getStorageAt:   (contract: EvmAddress, slot: bigint) => Promise<Uint8Array>;
  getBalance:     (address: EvmAddress) => Promise<GasTokenOf<D, DomainsOf<"Evm">>>;
  getLatestBlock: () => Promise<bigint>;
}
