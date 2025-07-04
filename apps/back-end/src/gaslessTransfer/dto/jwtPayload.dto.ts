import type { Usdc } from "@stable-io/cctp-sdk-definitions";
import { usdc } from "@stable-io/cctp-sdk-definitions";
import type { Permit2TypedData } from "@stable-io/cctp-sdk-evm";
import { IsNotEmpty, IsObject, ValidateNested } from "class-validator";
import { QuoteRequestDto } from "./quoteRequest.dto";
import { IsUsdcAmount } from "../../common/validators";

export class JwtPayloadDto {
  /**
   * Permit2 typed data for user signature
   */
  // @note: We don't use ValidateNested here because the structure is guaranteed by the JWT
  // signature and we won't be manipulating it
  @IsObject()
  @IsNotEmpty()
  readonly permit2TypedData!: Permit2TypedData;

  /**
   * Original quote request parameters
   */
  @ValidateNested()
  readonly quoteRequest!: QuoteRequestDto;

  @IsUsdcAmount({ min: usdc(0.000001) })
  readonly gaslessFee!: Usdc;
}
