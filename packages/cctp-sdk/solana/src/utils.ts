import type { Layout, DeriveType } from "binary-layout";
import { deserialize } from "binary-layout";
import { isArray, mapTo } from "@stable-io/map-utils";
import { encoding, sha256, ed25519, throws, isUint8Array } from "@stable-io/utils";
import type { RoArray, MaybeArray, MapArrayness } from "@stable-io/map-utils";
import { type KindWithAtomic, Amount } from "@stable-io/amount";
import type { Byte, Sol, DistributiveAmount } from "@stable-io/cctp-sdk-definitions";
import { sol } from "@stable-io/cctp-sdk-definitions";
import {
  associatedTokenProgramId,
  tokenProgramId,
  rentCost,
  emptyAccountSize,
} from "./constants.js";
import { SolanaAddress } from "./address.js";
import type { SolanaClient, AccountInfo } from "./platform.js";
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
  const enc = { encoding: "base64" } as const;
  const accInfos = (await (isArray(addressEs)
    ? client.getMultipleAccounts(addressEs.map(addr => addr.unwrap()), enc)
    : client.getAccountInfo(addressEs.unwrap(), enc)
  ).send()).value;
  return mapTo(accInfos)(accInfo =>
    accInfo
    ? { executable: accInfo.executable,
        owner:      new SolanaAddress(accInfo.owner),
        lamports:   sol(accInfo.lamports, "lamports"),
        data:       encoding.base64.decode(accInfo.data[0]),
      }
    : undefined,
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
): Promise<MapArrayness<A, Sol>> {
  return mapTo(await getAccountInfo(client, solAccs))(
    accInfo => accInfo?.lamports ?? sol(0, "lamports"),
  ) as any;
}

export async function getTokenBalance<
  const A extends MaybeArray<SolanaAddress>,
  const K extends KindWithAtomic,
>(
  client: SolanaClient,
  tokenAccs: A,
  kind: K,
): Promise<MapArrayness<A, DistributiveAmount<K>>> {
  return mapTo(await getDeserializedAccount(client, tokenAccs, tokenAccountLayout(kind)))(
    maybeToken => maybeToken?.amount ?? Amount.from(0, kind, "atomic"),
  ) as any;
}
