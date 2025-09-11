// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Base64EncodedWireTransaction, Instruction, KeyPairSigner, TransactionMessage, TransactionMessageWithFeePayer } from "@solana/kit";
import {
  AccountRole,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  appendTransactionMessageInstructions,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransaction,
  getBase64EncodedWireTransaction,
  compileTransaction,
} from "@solana/kit";
import type { Layout, DeriveType } from "binary-layout";
import { deserialize, serialize } from "binary-layout";
import { isArray, mapTo } from "@stable-io/map-utils";
import { encoding, sha256, ed25519, throws, isUint8Array } from "@stable-io/utils";
import type { RoArray, MaybeArray, MapArrayness, RoPair } from "@stable-io/map-utils";
import { type KindWithAtomic } from "@stable-io/amount";
import type { Byte, Sol, DistributiveAmount } from "@stable-io/cctp-sdk-definitions";
import {
  associatedTokenProgramId,
  tokenProgramId,
  rentCost,
  emptyAccountSize,
  systemProgramId,
} from "./constants.js";
import { SolanaAddress } from "./address.js";
import type { SolanaClient, AccountInfo, TxMsg, SignableTxMsg, TxMsgWithFeePayer } from "./platform.js";
import { tokenAccountLayout } from "./layoutItems.js";

const discriminatorTypeConverter = {
  instruction: "global",
  account: "account",
  event: "event",
  anchor: "anchor",
} as const;
export type DiscriminatorType = keyof typeof discriminatorTypeConverter;

export const discriminatorLength = 8;
export const discriminatorOf = (type: DiscriminatorType, name: string) =>
  sha256(`${discriminatorTypeConverter[type]}:${name}`).subarray(0, discriminatorLength);

//see here: https://github.com/solana-foundation/anchor/blob/master/lang/src/event.rs
//Why they chose to use little endian here, when all other discriminators are big endian is
//  entirely beyond me.
export const anchorEmitCpiDiscriminator = discriminatorOf("anchor", "event").reverse();

export type Seed = string | Uint8Array | SolanaAddress;
const seedToBytes = (seed: Seed) =>
  typeof seed === "string"
  ? encoding.bytes.encode(seed)
  : isUint8Array(seed)
  ? seed
  : seed.toUint8Array();

export type Seeds = Seed | RoArray<Seed>;
const bytifySeeds = (seeds: Seeds) =>
  isArray(seeds) ? encoding.bytes.concat(...seeds.map(seedToBytes)) : seedToBytes(seeds);

const pdaStrConst = encoding.bytes.encode("ProgramDerivedAddress");
const calcRawPda = (seeds: Seeds, bump: number, programId: SolanaAddress) =>
  sha256(encoding.bytes.concat(
    bytifySeeds(seeds),
    new Uint8Array([bump]),
    programId.toUint8Array(),
    pdaStrConst,
  ));

export function calcPda(seeds: Seeds, bump: number, programId: SolanaAddress): SolanaAddress {
  return new SolanaAddress(calcRawPda(seeds, bump, programId));
}

const isOffCurve = (rawAddress: Uint8Array) =>
  throws(() => ed25519.Point.fromHex(rawAddress));

export function findPda(seeds: Seeds, programId: SolanaAddress): [SolanaAddress, number] {
  let bump = 255;
  seeds = bytifySeeds(seeds);
  while (true) { //P(not finding a valid PDA) << P(cosmic ray mucking up the computation)
    const candidate = calcRawPda(seeds, bump, programId);
    if (isOffCurve(candidate))
      return [new SolanaAddress(candidate), bump];

    --bump;
  }
}

export function findAta(
  owner: SolanaAddress,
  mint: SolanaAddress,
  tokenProgram: SolanaAddress = tokenProgramId,
): SolanaAddress {
  return findPda([owner, tokenProgram, mint], associatedTokenProgramId)[0];
}

export function minimumBalanceForRentExemption(size: Byte): Sol {
  return emptyAccountSize.add(size).convert(rentCost);
}

export async function getAccountInfo<const A extends MaybeArray<SolanaAddress>>(
  client: SolanaClient,
  addressEs: A,
): Promise<MapArrayness<A, AccountInfo | undefined>> {
  return await (isArray(addressEs)
    ? client.getMultipleAccounts(addressEs)
    : client.getAccountInfo(addressEs)
  ) as MapArrayness<A, AccountInfo | undefined>;
}

export async function getDeserializedAccount<
  const A extends MaybeArray<SolanaAddress>,
  const L extends Layout,
>(
  client: SolanaClient,
  addressEs: A,
  layout: L,
): Promise<MapArrayness<A, DeriveType<L> | undefined>> {
  return mapTo(await getAccountInfo(client, addressEs))(
    accInfo => accInfo ? deserialize(layout, accInfo.data) : undefined,
  ) as MapArrayness<A, DeriveType<L> | undefined>;
}

export async function getSolBalance<
  const A extends MaybeArray<SolanaAddress>,
>(
  client: SolanaClient,
  solAccs: A,
): Promise<MapArrayness<A, Sol | undefined>> {
  return mapTo(await getAccountInfo(client, solAccs))(
    accInfo => accInfo?.lamports,
  ) as any;
}

export async function getTokenBalance<
  const A extends MaybeArray<SolanaAddress>,
  const K extends KindWithAtomic,
>(
  client: SolanaClient,
  tokenAccs: A,
  kind: K,
): Promise<MapArrayness<A, DistributiveAmount<K> | undefined>> {
  return mapTo(await getDeserializedAccount(client, tokenAccs, tokenAccountLayout(kind)))(
    maybeToken => maybeToken?.amount,
  ) as any;
}

export type Ix = Required<Instruction>;
export function composeIx<const L extends Layout>(
  addrRoles: RoArray<RoPair<SolanaAddress, AccountRole>>,
  layout: L,
  params: DeriveType<L>,
  programAddress: SolanaAddress,
): Ix {
  return {
    accounts: addrRoles.map(([address, role]) => ({ address: address.unwrap(), role })),
    data: serialize(layout, params),
    programAddress: programAddress.unwrap(),
  };
}

export function feePayerTxFromIxs(
  ixs: Ix | readonly Ix[],
  payer: SolanaAddress,
  version: "legacy" | 0 = "legacy",
): TransactionMessage & TransactionMessageWithFeePayer {
  return pipe(
    createTransactionMessage({ version }),
    tx => setTransactionMessageFeePayer(payer.unwrap(), tx),
    tx => appendTransactionMessageInstructions(isArray(ixs) ? ixs : [ixs], tx),
  );
}

export function composeCreateAtaIx(
  payer: SolanaAddress,
  owner: SolanaAddress,
  mint: SolanaAddress,
  idempotent: boolean = true,
  tokenProgram: SolanaAddress = tokenProgramId,
): Ix {
  const ata = findAta(owner, mint, tokenProgram);
  const accounts = [
    [payer,           AccountRole.WRITABLE_SIGNER],
    [ata,             AccountRole.WRITABLE       ],
    [owner,           AccountRole.READONLY       ],
    [mint,            AccountRole.READONLY       ],
    [systemProgramId, AccountRole.READONLY       ],
    [tokenProgram,    AccountRole.READONLY       ],
  ] as const;
  return composeIx(accounts,
    { binary: "uint", size: 1 }, //see https://docs.rs/spl-associated-token-account-interface/latest/spl_associated_token_account_interface/instruction/enum.AssociatedTokenAccountInstruction.html
    idempotent ? 1 : 0,
    associatedTokenProgramId,
  );
}

export async function addLifetimeAndSendTx(client: SolanaClient, tx: TxMsgWithFeePayer, signers: readonly KeyPairSigner[]) {
  const { blockhash, lastValidBlockHeight } = await client.getLatestBlockhash();
  const txWithLifetime = setTransactionMessageLifetimeUsingBlockhash(
    { blockhash, lastValidBlockHeight },
    tx
  );
  return sendTx(client, txWithLifetime, signers);
}

async function sendTx(client: SolanaClient, tx: SignableTxMsg, signers: readonly KeyPairSigner[]) {
  const compiledTx = compileTransaction(tx);
  const signedTx = await signTransaction(signers.map(kp => kp.keyPair), compiledTx);
  const wireTx: Base64EncodedWireTransaction = getBase64EncodedWireTransaction(signedTx);
  return client.sendTransaction(wireTx);
}