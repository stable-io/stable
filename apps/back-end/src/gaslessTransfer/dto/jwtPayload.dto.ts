import type { Usdc } from "@stable-io/cctp-sdk-definitions";
import type { Permit2GaslessData } from "@stable-io/cctp-sdk-cctpr-evm";
import { IsNotEmpty, IsObject, IsOptional, ValidateNested } from "class-validator";
import { QuoteRequestDto } from "./quoteRequest.dto";
import { IsUsdcAmount } from "../../common/validators";
import { Domain } from "../../common/types";
import { GaslessTransferService } from "../gaslessTransfer.service";
import { SignableEncodedBase64MessageDto } from "./relayRequest.dto";

export class JwtPayloadDto<SourceDomain extends Domain = Domain> {
  /**
   * Permit2 typed data for user signature
   */
  // @note: We don't use ValidateNested here because the structure is guaranteed by the JWT
  // signature and we won't be manipulating it
  @IsOptional()
  @IsObject()
  @IsNotEmpty()
  readonly permit2GaslessData?: Permit2GaslessData;

  /**
   * Original quote request parameters
   */
  @ValidateNested()
  readonly quoteRequest!: QuoteRequestDto<SourceDomain>;

  @IsUsdcAmount({ min: GaslessTransferService.minimumGaslessFee.toUnit("human").toFixed() })
  readonly gaslessFee!: Usdc;

  /**
   * Encoded Solana transaction for gasless transfer
   */
  // @note: We don't use ValidateNested here because the structure is guaranteed by the JWT
  // signature and we won't be manipulating it
  @IsOptional()
  @IsObject()
  @IsNotEmpty()
  readonly encodedTx?: SignableEncodedBase64MessageDto;
}
