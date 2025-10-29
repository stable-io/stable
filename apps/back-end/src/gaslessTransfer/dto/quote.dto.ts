// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { ApiProperty } from "@nestjs/swagger";

export class QuoteDto {
  /**
   * Server-signed JWT containing the permit2 permit data for the user to sign as well as the quote data
   * @example "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
   */
  @ApiProperty({
    format: "jwt",
  })
  jwt!: string;
}
