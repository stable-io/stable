import type { Permit2GaslessData } from "@stable-io/cctp-sdk-cctpr-evm";

import type { PlainDto } from "../common/types";
import type { QuoteRequestDto } from "./dto";
import { Base64EncodedBytes } from "@solana/kit";

export type RelayTx = {
  hash: `0x${string}`;
};

export interface JwtPayload extends Record<string, unknown> {
  readonly willRelay: boolean;
  readonly encodedTx?: Base64EncodedBytes;
  readonly signedMessage?: Base64EncodedBytes;
  readonly permit2GaslessData?: Permit2GaslessData ;
  readonly quoteRequest: PlainDto<QuoteRequestDto>;
  readonly gaslessFee: string; // Usdc =(
}
