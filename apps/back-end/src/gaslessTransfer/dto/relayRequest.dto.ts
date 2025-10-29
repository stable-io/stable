// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, ValidateNested, IsNotEmpty } from "class-validator";
import { Transform, Type } from "class-transformer";

import type { Domain, ParsedSignature } from "../../common/types";
import { IsSignature } from "../../common/validators";
import { IsSignedJwt } from "../../auth";
import type { JwtPayloadDto } from "./jwtPayload.dto";
import { ValidatePermitSignature } from "../validators";
import { SignableEncodedBase64MessageDto } from "./signableEncodedBase64Message.dto";

export class PermitDto {
  /**
   * User's signature of a permit message for permit2 contract
   * @example "0x1234567890abcdef..."
   */
  @ApiProperty({
    type: String,
    format: "hex",
    pattern: "^0x[a-fA-F0-9]{130}$",
  })
  @IsSignature()
  signature!: ParsedSignature;

  /**
   * Permit value amount as string (converted from bigint)
   * @example "1000000"
   */
  @ApiProperty({
    type: String,
    description: "Permit value amount as string representation of bigint",
  })
  @IsNotEmpty()
  @Transform(({ value }) => BigInt(value))
  value!: bigint;

  /**
   * Permit deadline as string representation of bigint
   * @example "1704067200"
   */
  @ApiProperty({
    type: String,
    description: "Permit deadline as string representation of bigint",
  })
  @IsNotEmpty()
  @Transform(({ value }) => {
    return BigInt(value);
  })
  deadline!: bigint;
}

export class RelayRequestDto<SourceDomain extends Domain = Domain> {
  /**
   * Server-signed JWT containing the permit2 permit data for the user to sign as well as the quote data
   * @example "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
   */
  @ApiProperty({
    type: String,
    format: "jwt",
  })
  @IsSignedJwt()
  jwt!: JwtPayloadDto<SourceDomain>;

  /// ------------------- Evm specific fields -------------------

  /**
   * User's signature of the permit2 message
   * @example "0x1234567890abcdef..."
   */
  @ApiProperty({
    type: String,
    format: "hex",
    pattern: "^0x[a-fA-F0-9]{130}$",
    required: false,
  })
  @IsOptional()
  @IsSignature()
  permit2Signature?: ParsedSignature;

  /**
   * User's permit data including signature, value, and deadline
   */
  @ApiProperty({
    type: PermitDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PermitDto)
  @ValidatePermitSignature()
  permit?: PermitDto;

  /// ------------------- Solana specific fields -------------------

  @ApiProperty({
    type: SignableEncodedBase64MessageDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SignableEncodedBase64MessageDto)
  encodedTx?: SignableEncodedBase64MessageDto;
}
