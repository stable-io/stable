import { Permit2TypedData } from "@stable-io/cctp-sdk-evm";

import type { PlainDto } from "../common/types";
import type { QuoteRequestDto } from "./dto";

export type RelayTx = {
  hash: `0x${string}`;
};

export interface JwtPayload extends Record<string, unknown> {
  readonly permit2TypedData: Permit2TypedData;
  readonly quoteRequest: PlainDto<QuoteRequestDto>;
  readonly gaslessFee: string; // Usdc =(
}
