import { mapTo } from "@stable-io/map-utils";
import { Byte, byte, sol } from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress } from "./address.js"
import { Conversion } from "../../../common/amount/dist/conversion.js";

export const [
  systemProgramId,
  computeBudgetProgramId,
  tokenProgramId,
  token2022ProgramId,
  associatedTokenProgramId,
] = mapTo([
  "11111111111111111111111111111111",
  "ComputeBudget111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
])((address) => new SolanaAddress(address));

export const emptyAccountSize = byte(128);
export const rentCost = Conversion.from(sol(6_960, "lamports"), Byte);
