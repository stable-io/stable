// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { domainsOf } from "@stable-io/cctp-sdk-definitions";
import type { Domain, Network } from "../../common/types";

const domains = ["Solana", "Sui"].concat(
  domainsOf("Evm").filter((domain) => domain !== "Codex"),
);
export class PriceRequestDto {
  /**
   * The blockchain domain to get price information for
   * @example "Ethereum"
   */
  @ApiProperty({
    enum: domains,
    description: "The blockchain domain to get price information for",
  })
  @IsIn(domains)
  domain!: Domain;
}
