// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { type Layout, serialize, deserialize } from "binary-layout";
import { type KindWithAtomic, Amount } from "@stable-io/amount";
import { type Network, amountItem } from "@stable-io/cctp-sdk-definitions";
import { keccak256 } from "@stable-io/utils";
import { EvmAddress } from "./address.js";
import type { ContractTx, EvmClient, CallData } from "./platform.js";
import { wordSize, selectorItem, evmAddressItem, paddedSlotItem } from "./layoutItems.js";

export async function getTokenBalance<const K extends KindWithAtomic>(
  client: EvmClient,
  token:  EvmAddress,
  owner:  EvmAddress,
  kind:   K,
): Promise<Amount<K>> {
  const balanceOfLayout = [
    selectorItem("balanceOf(address)"),
    { name: "owner", ...paddedSlotItem(evmAddressItem) },
  ] as const satisfies Layout;

  return deserialize(
    amountItem(wordSize, kind),
    await client.ethCall({
      to: token,
      data: serialize(balanceOfLayout, { owner }) as CallData,
    }),
  );
}

export async function getTokenAllowance<const K extends KindWithAtomic>(
  client:  EvmClient,
  token:   EvmAddress,
  owner:   EvmAddress,
  spender: EvmAddress,
  kind:    K,
): Promise<Amount<K>> {
  const allowanceLayout = [
    selectorItem("allowance(address,address)"),
    { name: "owner", ...paddedSlotItem(evmAddressItem) },
    { name: "spender", ...paddedSlotItem(evmAddressItem) },
  ] as const satisfies Layout;

  return client.ethCall({
    to: token,
    data: serialize(allowanceLayout, { owner, spender }) as CallData,
  }).then(resp => deserialize(amountItem(wordSize, kind), resp));
}

export function composeApproveTx(
  token:   EvmAddress,
  owner:   EvmAddress,
  spender: EvmAddress,
  amount:  Amount<KindWithAtomic>,
): ContractTx {
  const approveLayout = [
    selectorItem("approve(address,uint256)"),
    { name: "spender", ...paddedSlotItem(evmAddressItem) },
    { name: "amount", ...amountItem(wordSize, amount.kind) },
  ] as const satisfies Layout;

  return {
    from: owner,
    to: token,
    data: serialize(approveLayout, { spender, amount }) as CallData,
  };
}

export function dateToUnixTimestamp(date: Date): bigint {
  if (date.getTime() < 0)
    throw new Error("Date is before unix epoch");

  return BigInt(Math.floor(date.getTime() / 1000));
}

export const selectorLength = 4;
export const selectorOf = (funcSig: string) =>
  keccak256(funcSig).subarray(0, selectorLength) as CallData;

export const init = <N extends Network>(network: N) => ({
  getTokenBalance,
  getTokenAllowance,
  composeApproveTx,
} as const);
