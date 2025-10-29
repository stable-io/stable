// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

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