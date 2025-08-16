import { encoding, sha256, ed25519, throws, isUint8Array } from "@stable-io/utils";
import { type RoArray } from "@stable-io/map-utils";
import type { Byte, Sol } from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress } from "./address.js";
import {
  associatedTokenProgramId,
  tokenProgramId,
  rentCost,
  emptyAccountSize,
} from "./constants.js";

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
  Array.isArray(seeds)
  ? encoding.bytes.concat(...seeds.map(seedToBytes))
  : seedToBytes(seeds as Seed);

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
