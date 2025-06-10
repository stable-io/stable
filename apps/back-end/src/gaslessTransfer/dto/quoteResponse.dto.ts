import { ValidateNested } from "class-validator";
import { ApiResponseDto } from "../../common/types.js";
import { QuoteDto } from "./quote.dto.js";

export class QuoteResponseDto extends ApiResponseDto<QuoteDto> {
  @ValidateNested()
  declare public data: QuoteDto;
}
