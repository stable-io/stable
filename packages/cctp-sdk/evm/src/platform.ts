// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { DomainsOf, EvmGasToken, GasTokenOf, Network, Usdc } from "@stable-io/cctp-sdk-definitions";
import type { Brand, BrandedSubArray } from "@stable-io/utils";
import { EvmAddress } from "./address.js";

export type CallData = Brand<BrandedSubArray<CallData>, "CallData">;
export type ReturnData = Brand<BrandedSubArray<ReturnData>, "ReturnData">;
export type StorageData = Brand<BrandedSubArray<StorageData>, "StorageData">;

export type AccessList = {
  address: EvmAddress;
  storageKeys: bigint[];
}[];

export interface BaseTx {
  to?: EvmAddress;
  from?: EvmAddress;
  value?: EvmGasToken;
  data?: CallData;
  accessList?: AccessList;
}

export interface ReadCall extends BaseTx {
  to: EvmAddress;
  value?: EvmGasToken;
  data: CallData;
}

export interface ContractTx extends BaseTx {
  to: EvmAddress;
  value?: EvmGasToken;
  data: CallData;
}

export interface ValueTx extends BaseTx {
  value: EvmGasToken;
}

export interface ContractValueTx extends BaseTx {
  to: EvmAddress;
  value: EvmGasToken;
  data: CallData;
}

export interface EvmClient<
  N extends Network = Network,
  D extends DomainsOf<"Evm"> = DomainsOf<"Evm">,
> {
  readonly network: N;
  readonly domain: D;
  readonly estimateGas: (tx: BaseTx) => Promise<bigint>;
  readonly ethCall: (tx: ContractTx) => Promise<Uint8Array>;
  readonly getStorageAt: (contract: EvmAddress, slot: bigint) => Promise<Uint8Array>;
  readonly getBalance: (address: EvmAddress) => Promise<GasTokenOf<D, DomainsOf<"Evm">>>;
  readonly getLatestBlock: () => Promise<bigint>;
}

type Eip2612MessageBody = {
  owner: string;
  spender: string;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
};

export type Eip712Data<MessageType> = Readonly<{
  types: Record<string, readonly Readonly<{ name: string; type: string }>[]>;
  primaryType: string;
  domain: {
    name?: string;
    version?: string;
    chainId?: bigint;
    verifyingContract?: `0x${string}`;
    salt?: `0x${string}`;
  };
  message: MessageType;
}>;

export type Eip2612Data = Eip712Data<Eip2612MessageBody>;

export interface Permit2TransferFromMessage {
  readonly permitted: {
    readonly token: string;
    readonly amount: bigint;
  };
  readonly nonce: bigint;
  readonly deadline: bigint;
}

export type Permit2TypedData = Eip712Data<Permit2TransferFromMessage>;
