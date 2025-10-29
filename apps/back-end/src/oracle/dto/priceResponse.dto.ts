// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { ValidateNested } from "class-validator";
import type { ApiResponseDto } from "../../common/types";
import type { PriceDto } from "./price.dto.ts";

export class PriceResponseDto implements ApiResponseDto<PriceDto> {
  @ValidateNested()
  public data!: PriceDto;
}
