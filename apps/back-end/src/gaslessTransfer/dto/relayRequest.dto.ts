import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional } from "class-validator";
import { Transform } from "class-transformer";

import { Usdc, usdc } from "@stable-io/cctp-sdk-definitions";

import { IsBooleanString, IsUsdcAmount } from "../../common/validators";
import { IsSignedJwt } from "../../auth";
import type { JwtPayloadDto } from "./jwtPayload.dto";

export class RelayRequestDto {
  /**
   * Server-signed JWT containing the permit2 permit data for the user to sign as well as the quote data
   * @example "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
   */
  @ApiProperty({
    type: String,
    format: "jwt",
  })
  @IsSignedJwt()
  jwt!: JwtPayloadDto;

  /**
   * User's signature of the permit2 message
   * @example "0x1234567890abcdef..."
   */
  @ApiProperty({
    format: "hex",
    pattern: "^0x[a-fA-F0-9]+$",
  })
  @IsNotEmpty()
  permit2Signature!: string;

  /**
   * User's signature of a permit message for permit2 contract
   * @example "0x1234567890abcdef..."
   */
  @ApiProperty({
    format: "hex",
    pattern: "^0x[a-fA-F0-9]+$",
  })
  @IsOptional()
  permitSignature!: string;

  /**
   * Whether the fees will be taken from the input or added
   * on top of it
   * @example "true"
   */
  @IsBooleanString()
  @IsOptional()
  takeFeesFromInput!: "true" | "false";

  /**
   * Max usdc value the user is willing to pay for a relay.
   * Not sure at this point if in the gasless case is for both
   * relays or only the gasless one. We need to check with @r8zon
   */
  @IsUsdcAmount({ min: usdc(0.000001) })
  maxRelayFee!: Usdc;

    /**
   * Max usdc value the user is willing to pay for fast transfer.
   */
    @IsUsdcAmount({ min: usdc(0.000001) })
    maxFastFee!: Usdc;
}
