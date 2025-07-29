import { ValidateNested } from "class-validator";
import type { ApiResponseDto } from "../../common/types";
import type { PriceDto } from "./price.dto.ts";

export class PriceResponseDto implements ApiResponseDto<PriceDto> {
  @ValidateNested()
  public data!: PriceDto;
}
