import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
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
}
