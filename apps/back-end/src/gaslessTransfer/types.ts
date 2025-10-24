import type { Permit2GaslessData } from "@stable-io/cctp-sdk-cctpr-evm";

import type { PlainDto } from "../common/types";
import type { QuoteRequestDto } from "./dto";
import { Base64EncodedBytes } from "@solana/kit";
import { SignableEncodedBase64Message } from "@stable-io/cctp-sdk-cctpr-solana";

export type RelayTx = {
  hash: string;
};

export interface JwtPayload extends Record<string, unknown> {
  readonly willRelay: boolean;
  readonly encodedTx?: SignableEncodedBase64Message;
  readonly signedMessage?: Base64EncodedBytes;
  readonly permit2GaslessData?: Permit2GaslessData ;
  readonly quoteRequest: PlainDto<QuoteRequestDto>;
  readonly gaslessFee: string; // Usdc =(
}
