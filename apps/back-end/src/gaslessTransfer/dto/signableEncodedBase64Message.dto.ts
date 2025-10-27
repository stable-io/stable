import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class SignableEncodedBase64MessageDto {
  @ApiProperty({
    type: String,
    format: "base64",
    required: false,
    description: 'Base64-encoded signed serialized transaction for Solana gasless transfers',
  })
  @IsNotEmpty()
  encodedSolanaTx!: string;
}