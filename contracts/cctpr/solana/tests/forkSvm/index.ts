// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type {
  Address,
  Lamports,
  Rpc,
  GetAccountInfoApi,
  GetMultipleAccountsApi,
  RpcTransport,
  RpcResponseData,
  AccountInfoBase,
  Base64EncodedBytes,
  Base64EncodedDataResponse,
} from "@solana/kit";
import {
  createSolanaRpc,
  createSolanaRpcFromTransport,
  createRpcMessage,
  getBase64Codec,
  getAddressDecoder,
} from "@solana/kit";
import { createHttpTransport } from "@solana/rpc-transport-http";
import { isJsonRpcPayload } from "@solana/rpc-spec";
import { LiteSVM, AccountInfo as SvmAccountInfo } from "./liteSvm/index.js";

type CustomFuncs = {
  advanceToNow: () => Promise<void>;
  clearForkCache: () => void
};
export type ForkSvm = Rpc<GetAccountInfoApi & GetMultipleAccountsApi> & LiteSVM & CustomFuncs;

export function createForkSvm(upstreamRpc: string): ForkSvm {
  const liteSvm = (new LiteSVM()).withBuiltins().withSysvars().withSplPrograms();
  const fetchedAccounts = new Set<Address>([
    //incomplete list - only contains the essentials
    "11111111111111111111111111111111",
    "BPFLoaderUpgradeab1e11111111111111111111111",
    "ComputeBudget111111111111111111111111111111",
    "Sysvar1nstructions1111111111111111111111111",
    "SysvarC1ock11111111111111111111111111111111",
    "SysvarRent111111111111111111111111111111111",
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  ] as Address[]);
  const forkTransport = createForkTransport(upstreamRpc, liteSvm, fetchedAccounts);
  const normalRpc = createSolanaRpc(upstreamRpc);
  const customRpc = createSolanaRpcFromTransport(forkTransport);
  const customFuncs = {
    advanceToNow: async () => {
      const clock = liteSvm.getClock();
      clock.slot = await normalRpc.getSlot().send();
      clock.unixTimestamp = await normalRpc.getBlockTime(clock.slot).send();
      //again only setting the essentials, skipping all the epoch and leader schedule stuff
      liteSvm.setClock(clock);
    },
    clearForkCache: () => fetchedAccounts.clear()
  };
  const result = Object.assign({}, liteSvm, customRpc, customFuncs);

  // Manually copy known RPC methods
  const rpcMethods = ['getAccountInfo', 'getMultipleAccounts', 'getSlot', 'getBlockTime'];
  for (const method of rpcMethods) {
    if (typeof customRpc[method] === 'function') {
      result[method] = customRpc[method].bind(customRpc);
    }
  }

  // Copy prototype methods from both liteSvm and customRpc
  const copyPrototypeMethods = (source: any) => {
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(source))
      .filter(name => name !== 'constructor' && typeof source[name] === 'function');
    
    for (const methodName of methodNames)
      result[methodName] = source[methodName].bind(source);
  };

  copyPrototypeMethods(liteSvm);
  copyPrototypeMethods(customRpc);

  return result;
}

// --- Implementation ---

type TransportAccountInfo = AccountInfoBase & { data: Base64EncodedDataResponse };

type TransportConfig = Parameters<RpcTransport>[0];

const createRpcResponse = <const T>(value: T, liteSvm: LiteSVM) => ({
  jsonrpc: "2.0",
  result: {
    context: { apiVersion: "2.3.6", slot: Number(liteSvm.getClock().slot) },
    value,
  },
  id: 1 as number
} as const);

type SolanaRpcResponse<T> = ReturnType<typeof createRpcResponse<T>>;
type SolanaRpcResult<T> = SolanaRpcResponse<T>["result"];

const throwOnError = <T>(response: RpcResponseData<T>): RpcResponseData<T> & { result: T } => {
  if ("error" in response)
    throw new Error(`Unexpected RPC error response: ${JSON.stringify(response.error)}`);

  return response;
}

function createForkTransport(
  upstreamRpc: string,
  liteSvm: LiteSVM,
  fetchedAccounts: Set<Address>,
): RpcTransport {
  const upstreamTransport = createHttpTransport({ url: upstreamRpc });
  const queryUpstream = async <R>(methodName: string, params: readonly unknown[]): Promise<R> =>
    upstreamTransport({ payload: createRpcMessage({ methodName, params }) })
      .then(response => throwOnError(response as RpcResponseData<R>).result
      );
     
  const queryUpstreamAcc = async <T>(method: string, addr: unknown): Promise<T> =>
    queryUpstream<SolanaRpcResult<T>>(method, [addr, { encoding: "base64" }]).then(r => r.value);

  const upstreamGetAccountInfo = async (address: Address) =>
    queryUpstreamAcc<TransportAccountInfo | null>("getAccountInfo", address);

  const upstreamGetMultipleAccounts = async (addresses: Address[]) =>
    queryUpstreamAcc<(TransportAccountInfo | null)[]>("getMultipleAccounts", addresses);

  const toRpcResponse = <const T>(value: T) =>
    createRpcResponse(value, liteSvm);

  const base64 = getBase64Codec();

  const liteSvmAccountToKitAccount = (acc: SvmAccountInfo): TransportAccountInfo => ({
    executable: acc.executable,
    lamports: acc.lamports as Lamports,
    owner: acc.owner,
    data: [base64.decode(acc.data) as Base64EncodedBytes, "base64"],
    rentEpoch: acc.rentEpoch,
    space: acc.space,
  });
  
  const kitAccountToLiteSvmAccount = (acc: TransportAccountInfo): SvmAccountInfo => ({
    executable: acc.executable,
    lamports: acc.lamports,
    owner: acc.owner,
    data: base64.encode(acc.data[0]) as Uint8Array,
    rentEpoch: acc.rentEpoch,
    space: acc.space,
  });

  const shouldFetchFromUpstream = (address: Address) => {
    if (fetchedAccounts.has(address))
      return false;

    if (liteSvm.getAccount(address)) {
      fetchedAccounts.add(address);
      return false;
    }

    return true;
  }

  const setSvmAccountFromUpstream =
    async (address: Address, upstream: TransportAccountInfo | null) => {
      fetchedAccounts.add(address);
      if (!upstream)
        return null;

      liteSvm.setAccount(address, kitAccountToLiteSvmAccount(upstream));

      if (!upstream.executable || upstream.owner !== "BPFLoaderUpgradeab1e11111111111111111111111")
        return upstream;

      //special handling for upgradable programs:
      //  also fetches the program data account from upstream
      //the programId account contains the address of the program data account
      //  (it's a pda of bpfUpgradeableLoader using the programId as its seed)
      const byteCodeAddress =
        getAddressDecoder().decode(base64.encode(upstream.data[0].slice(4, 36)));
      
      if (fetchedAccounts.has(byteCodeAddress))
        return upstream;
      
      const byteCodeAccount = await upstreamGetAccountInfo(byteCodeAddress);
      if (!byteCodeAccount)
        throw new Error(`Couldn't find bytecode account for program ${address}`);

      fetchedAccounts.add(byteCodeAddress);
      liteSvm.setAccount(byteCodeAddress, kitAccountToLiteSvmAccount(byteCodeAccount));
      
      return upstream;
    };

  const getKitFromSvm = (address: Address): TransportAccountInfo | null => {
    const account = liteSvm.getAccount(address);
    return account ? liteSvmAccountToKitAccount(account) : null;
  }

  const getAccountInfo =
    async (address: Address): Promise<SolanaRpcResponse<TransportAccountInfo | null>> =>
      toRpcResponse(shouldFetchFromUpstream(address)
        ? await setSvmAccountFromUpstream(address, await upstreamGetAccountInfo(address))
        : getKitFromSvm(address)
      );

  const getMultipleAccounts =
    async (addresses: Address[]): Promise<SolanaRpcResponse<(TransportAccountInfo | null)[]>> => {
      const unfetchedAddresses = addresses.filter(addr => shouldFetchFromUpstream(addr));
      if (unfetchedAddresses.length > 0) {
        await upstreamGetMultipleAccounts(unfetchedAddresses).then(accounts => accounts.map(
          (acc, i) => setSvmAccountFromUpstream(unfetchedAddresses[i], acc)
        ));
      }

      //wasteful because we're refetching the accounts from liteSvm, but at most once per account
      return toRpcResponse(addresses.map(addr => getKitFromSvm(addr)));
    };

  return function forkTransport<TResponse>(
    transportConfig: TransportConfig
  ): Promise<TResponse> {
    const { payload } = transportConfig;

    if (!isJsonRpcPayload(payload))
      throw new Error(`Unsupported payload: ${payload}`);

    if (!["getAccountInfo", "getMultipleAccounts"].includes(payload.method))
      throw new Error(`Unsupported method: ${payload.method}`);

    if (!Array.isArray(payload.params) || payload.params.length < 2)
      throw new Error(`Unexpected params: ${JSON.stringify(payload.params)}`);

    const encoding = payload.params[1]?.encoding;

    if (encoding !== "base64")
      throw new Error(`Missing or unsupported encoding: ${encoding}, expected "base64"`);

    return { getAccountInfo, getMultipleAccounts }[payload.method](payload.params[0]);
  };
}
