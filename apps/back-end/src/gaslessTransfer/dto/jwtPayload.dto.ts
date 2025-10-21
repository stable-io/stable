import type { Usdc } from "@stable-io/cctp-sdk-definitions";
import type { Permit2GaslessData } from "@stable-io/cctp-sdk-cctpr-evm";
import { IsNotEmpty, IsObject, IsString, ValidateNested } from "class-validator";
import { QuoteRequestDto } from "./quoteRequest.dto";
import { IsUsdcAmount } from "../../common/validators";
import { Domain } from "../../common/types";

export class JwtPayloadDto<SourceDomain extends Domain = Domain> {
  /**
   * Permit2 typed data for user signature
   */
  // @note: We don't use ValidateNested here because the structure is guaranteed by the JWT
  // signature and we won't be manipulating it
  @IsObject()
  @IsNotEmpty()
  readonly permit2GaslessData!: Permit2GaslessData;

  /**
   * Original quote request parameters
   */
  @ValidateNested()
  readonly quoteRequest!: QuoteRequestDto<SourceDomain>;

  @IsUsdcAmount({ min: "0.000001" })
  readonly gaslessFee!: Usdc;

  /**
   * Base64-encoded signature of the compiled solana transaction message
   */
  @IsString()
  readonly signedMessage?: string;
}
