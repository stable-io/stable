import { encoding, sha256, ed25519, throws } from "@stable-io/utils";
import { type RoArray } from "@stable-io/map-utils";
import { SolanaAddress } from "./address.js";

const discriminatorTypeConverter = {
  instruction: "global",
  account: "account",
  event: "event",
} as const;
export type DiscriminatorType = keyof typeof discriminatorTypeConverter;

export const discriminatorLength = 8;
export const discriminatorOf = (type: DiscriminatorType, name: string) =>
  sha256(`${discriminatorTypeConverter[type]}:${name}`).subarray(0, discriminatorLength);

export type Seeds = Uint8Array | RoArray<string | Uint8Array>;
const bytifySeeds = (seeds: Seeds): Uint8Array =>
  Array.isArray(seeds)
  ? encoding.bytes.concat(
      ...seeds.map(seed => typeof seed === "string" ? encoding.bytes.encode(seed) : seed)
    )
  : seeds as Uint8Array;

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
  throws(() => ed25519.ExtendedPoint.fromHex(rawAddress));

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
