import { ValidateNested } from "class-validator";
import type { ApiResponseDto } from "../../common/types.js";
import { QuoteDto } from "./quote.dto.js";

export class QuoteResponseDto implements ApiResponseDto<QuoteDto> {
  @ValidateNested()
  public data!: QuoteDto;
}
