// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { readdir, readFile, writeFile } from "node:fs/promises";
import type {
  Address,
  Lamports,
  Transaction,
  RpcTransport,
  AccountInfoBase,
  Base64EncodedBytes,
  AccountInfoWithBase64EncodedData,
} from "@solana/kit";
import {
  createSolanaRpc,
  getBase64Codec,
  getAddressDecoder,
  createSolanaRpcFromTransport,
} from "@solana/kit";
import { stringifyJsonWithBigints, parseJsonWithBigInts } from "@solana/rpc-spec-types";
import { isJsonRpcPayload } from "@solana/rpc-spec";
import type { AccountInfo as SvmAccountInfo } from "./liteSvm/index.js";
import { LiteSVM, TransactionMetadata } from "./liteSvm/index.js";

export type InnerInstruction = ReturnType<TransactionMetadata["innerInstructions"]>[number][number];
export type CompiledInstruction = ReturnType<InnerInstruction["instruction"]>;
export type TransactionReturnData = ReturnType<TransactionMetadata["returnData"]>
export type { TransactionMetadata };

type Rpc = ReturnType<typeof createSolanaRpc>;
type KitAccountInfo = AccountInfoBase & AccountInfoWithBase64EncodedData;

//TOOD should probably also store settings (unixtime, blockheight etc.)
export type Snapshot = Record<Address, null | SvmAccountInfo>;

const base64 = getBase64Codec();
const decodeAddr = getAddressDecoder().decode;

const builtin = new Set<Address>([
  //incomplete list - only contains the essentials
  "11111111111111111111111111111111",
  "BPFLoaderUpgradeab1e11111111111111111111111",
  "ComputeBudget111111111111111111111111111111",
  "Sysvar1nstructions1111111111111111111111111",
  "SysvarC1ock11111111111111111111111111111111",
  "SysvarRent111111111111111111111111111111111",
  "SysvarRecentB1ockHashes11111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
] as Address[]);

const range = (length: number) => Array.from({ length }).map((_, i) => i);

const passThrough =
  <V, P, R>(passThroughVal: V, f: (_: P) => R) =>
    (arg: P | V): V | R =>
      arg === passThroughVal ? passThroughVal : f(arg as P);

const mapIfArray =
  <P, R>(f: (_: P) => R) =>
    <V extends P | readonly P[]>(v: V) =>
      (Array.isArray(v) ? v.map(f) : f(v as P)) as P extends readonly P[] ? R[] : R;

const liteSvmAccountToKitAccount = passThrough(
  null,
  (acc: SvmAccountInfo): KitAccountInfo => ({
    executable: acc.executable,
    lamports: acc.lamports as Lamports,
    owner: acc.owner,
    data: [base64.decode(acc.data) as Base64EncodedBytes, "base64"],
    rentEpoch: acc.rentEpoch,
    space: acc.space,
  })
);

const kitAccountToLiteSvmAccount = passThrough(
  null,
  (acc: KitAccountInfo): SvmAccountInfo => ({
    executable: acc.executable,
    lamports: acc.lamports,
    owner: acc.owner,
    data: base64.encode(acc.data[0]) as Uint8Array,
    rentEpoch: acc.rentEpoch,
    space: acc.space,
  })
);

//TODO only supports legacy tx atm
export class ForkSvm {
  private readonly rpc: Rpc | undefined;
  private liteSvm: LiteSVM;
  private known: Set<Address>;

  constructor(url?: string) {
    this.liteSvm = (new LiteSVM()).withBuiltins().withSysvars().withSplPrograms();
    this.known = new Set();
    this.rpc = url ? createSolanaRpc(url) : undefined;
  }

  async readFromDisc(filepath: string) {
    filepath += filepath.endsWith("/") ? "" : "/";
    const filenames = (await readdir(filepath)).filter(filename => filename.endsWith(".json"));
    let executables = [] as ([Address, SvmAccountInfo | null])[];
    await Promise.all(filenames.map(async filename => {
      const addr = filename.slice(0, -5) as Address;
      const base64AccOrNull: any = parseJsonWithBigInts(await readFile(
        filepath + filename,
        { encoding: "utf-8" },
      ));
      if (base64AccOrNull?.data)
        base64AccOrNull.data = base64.encode(base64AccOrNull.data) as Uint8Array;
      const acc = base64AccOrNull as SvmAccountInfo | null;
      if (acc?.executable)
        executables.push([addr, acc])
      else
        this.setAccount(addr, acc);
    }));

    //set executable accounts last because liteSvm errs if bytecode accounts arn't set first
    for (const [addr, acc] of executables)
      this.setAccount(addr, acc);
  }

  async writeToDisc(filepath: string) {
    //TODO store blockhash, height etc.?
    filepath += filepath.endsWith("/") ? "" : "/";
    await Promise.all([...this.known.keys()].map(addr => {
      const acc = this.liteSvm.getAccount(addr);
      writeFile(
        filepath + addr + ".json",
        stringifyJsonWithBigints(acc ? { ...acc, data: base64.decode(acc.data) } : null),
        { encoding: "utf-8" },
      );
    }));
  }

  getSnapshot(): Snapshot {
    return Object.fromEntries([...this.known.keys()]
      .map((addr) => [addr, this.liteSvm.getAccount(addr)]));
  }

  restoreFromSnapshot(snapshot: Snapshot) {
    this.liteSvm = (new LiteSVM()).withBuiltins().withSysvars().withSplPrograms();
    this.known = new Set();
    for (const [addr, acc] of Object.entries(snapshot))
      if (acc)
        this.setAccount(addr as Address, acc);
  }

  latestTimestamp = () =>
    new Date(Number(this.liteSvm.getClock().unixTimestamp) / 1000);
  latestBlockheight = () =>
    this.liteSvm.getClock().slot;
  latestBlockhash = () =>
    this.liteSvm.latestBlockhash();
  getTransaction = (signature: Uint8Array) =>
    this.liteSvm.getTransaction(signature);
  expireBlockhash = () =>
    this.liteSvm.expireBlockhash();

  async advanceToNow() {
    if (this.rpc) {
      const clock = this.liteSvm.getClock();
      clock.slot = await this.rpc.getSlot().send();
      clock.unixTimestamp = await this.rpc.getBlockTime(clock.slot).send();
      //again only setting the essentials, skipping all the epoch and leader schedule stuff
      this.liteSvm.setClock(clock);
    }
    //expire genesis blockhash
    this.expireBlockhash();
  }

  async setClock(timestamp?: Date, slot?: bigint) {
    const clock = this.liteSvm.getClock();
    clock.slot = slot ?? clock.slot;
    clock.unixTimestamp = timestamp ? BigInt(timestamp.getTime() * 1000) : clock.unixTimestamp;
    this.liteSvm.setClock(clock);
  }

  async sendTransaction(tx: Transaction): Promise<TransactionMetadata> {
    await this.fetchUnfetchedOfTx(tx);
    const result = this.liteSvm.sendTransaction(tx);
    if (result instanceof TransactionMetadata)
      return result;

    throw result;
  }

  async simulateTransaction(tx: Transaction): Promise<TransactionMetadata> {
    await this.fetchUnfetchedOfTx(tx);
    const result = this.liteSvm.simulateTransaction(tx);
    if (result instanceof TransactionMetadata)
      return result;

    throw result;
  }

  async getAccount(address: Address): Promise<SvmAccountInfo | null> {
    return this.isUnfetched(address)
      ? this.setAccountFromUpstream(address, await this.fetchFromUpstream(address))
      : this.liteSvm.getAccount(address);
  }

  async getMultipleAccounts(addresses: readonly Address[]): Promise<(SvmAccountInfo | null)[]> {
    await this.fetchUnfetched(addresses);

    return addresses.map(addr => this.liteSvm.getAccount(addr));
  }

  airdrop(address: Address, lamports: bigint): void {
    this.known.add(address);
    this.liteSvm.airdrop(address, lamports);
  }

  addProgram (programId: Address, programBytes: Uint8Array): void {
    this.known.add(programId);
    this.liteSvm.addProgram(programId, programBytes);
  }

  addProgramFromFile = (programId: Address, path: string): void => {
    this.known.add(programId);
    this.liteSvm.addProgramFromFile(programId, path);
  }

  setAccount(address: Address, acc: SvmAccountInfo | null): void {
    this.known.add(address);
    if (acc)
      this.liteSvm.setAccount(address, acc);
  }

  private async fetchUnfetchedOfTx(tx: Transaction): Promise<void> {
    //TODO impl also for v0 transactions
    if (tx.messageBytes[0] >> 7)
      throw new Error("only implemented for legacy transactios");

    const len = tx.messageBytes[3];
    const encAccs = tx.messageBytes.subarray(4, 4 + len*32);
    const addresses = range(len).map(i => decodeAddr(encAccs.slice(i*32, (i+1)*32)));

    await this.fetchUnfetched(addresses);
  }

  private async fetchUnfetched(addresses: readonly Address[]): Promise<void> {
    const unfetchedAddresses = addresses.filter(addr => this.isUnfetched(addr));
    if (unfetchedAddresses.length === 0)
      return;

    const accs = await this.fetchFromUpstream(unfetchedAddresses);
    for (const i of range(unfetchedAddresses.length))
      this.setAccount(unfetchedAddresses[i], accs[i]);
  }

  private async setAccountFromUpstream(
    address: Address,
    upAcc: SvmAccountInfo | null
  ): Promise<SvmAccountInfo | null> {
    this.known.add(address);
    if (!upAcc)
      return null;

    if (upAcc.executable && upAcc.owner === "BPFLoaderUpgradeab1e11111111111111111111111") {
      //special handling for upgradable programs:
      //  also fetches the program data account from upstream
      //the programId account contains the address of the program data account
      //  (it's a pda of bpfUpgradeableLoader using the programId as its seed)
      const byteCodeAddress = decodeAddr(upAcc.data.slice(4, 36));

      if (this.isUnfetched(byteCodeAddress)) {
        const byteCodeAccount = await this.fetchFromUpstream(byteCodeAddress);
        if (!byteCodeAccount)
          throw new Error(`Couldn't find bytecode account for program ${address}`);

        this.known.add(byteCodeAddress);
        //liteSvm requires that we set the bytecode account before setting the programId account
        //  (it implicitly invokes the bpf upgradeable loader)
        this.liteSvm.setAccount(byteCodeAddress, byteCodeAccount);
      }
    }
    this.liteSvm.setAccount(address, upAcc);
    return upAcc;
  };

  private async fetchFromUpstream(address: Address): Promise<SvmAccountInfo | null>;
  private async fetchFromUpstream(address: readonly Address[]): Promise<(SvmAccountInfo | null)[]>;
  private async fetchFromUpstream(
    addressEs: Address | readonly Address[],
  ): Promise<SvmAccountInfo | null | (SvmAccountInfo | null)[]> {
    //if we don't have an RPC, we assume that uncached accounts don't exist
    if (!this.rpc)
      return mapIfArray(_ => null)(addressEs);

    const enc = { encoding: "base64" } as const;
    return mapIfArray(kitAccountToLiteSvmAccount)((
        Array.isArray(addressEs)
        ? (await this.rpc.getMultipleAccounts(addressEs, enc).send())
        : (await this.rpc.getAccountInfo(addressEs as Address, enc).send())
      ).value
    );
  }

  private isUnfetched(address: Address) {
    return !builtin.has(address) && !this.known.has(address);
  }
}

type TransportConfig = Parameters<RpcTransport>[0];

const createRpcResponse = <const T>(value: T, forkSvm: ForkSvm) => ({
  jsonrpc: "2.0",
  result: {
    context: { apiVersion: "2.3.6", slot: Number(forkSvm.latestBlockheight()) },
    value,
  },
  id: 1 as number
} as const);

type SolanaRpcResponse<T> = ReturnType<typeof createRpcResponse<T>>;

export function createForkTransport(forkSvm: ForkSvm): RpcTransport {
  const toRpcResponse = <const T>(value: T) =>
    createRpcResponse(value, forkSvm);

  const getAccountInfo =
    async (address: Address): Promise<SolanaRpcResponse<KitAccountInfo | null>> =>
      toRpcResponse(liteSvmAccountToKitAccount(await forkSvm.getAccount(address)));

  const getMultipleAccounts =
    async (addresses: Address[]): Promise<SolanaRpcResponse<(KitAccountInfo | null)[]>> =>
      toRpcResponse((await forkSvm.getMultipleAccounts(addresses)).map(liteSvmAccountToKitAccount));

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

export function createForkRpc(forkSvm: ForkSvm) {
  return createSolanaRpcFromTransport(createForkTransport(forkSvm));
}
