import type { Permit2GaslessData } from "@stable-io/cctp-sdk-cctpr-evm";
import type { SignableEncodedBase64Message } from "@stable-io/cctp-sdk-cctpr-solana";

import type { PlainDto } from "../common/types";
import type { QuoteRequestDto } from "./dto";

export type RelayTx = {
  hash: `0x${string}`;
};

export interface JwtPayload extends Record<string, unknown> {
  readonly willRelay: boolean;
  readonly solanaMessage?: SignableEncodedBase64Message;
  readonly permit2GaslessData?: Permit2GaslessData ;
  readonly quoteRequest: PlainDto<QuoteRequestDto>;
  readonly gaslessFee: string; // Usdc =(
}
