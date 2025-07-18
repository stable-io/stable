import { ValidateNested } from "class-validator";
import type { ApiResponseDto } from "../../common/types";
import { QuoteDto } from "./quote.dto";

export class QuoteResponseDto implements ApiResponseDto<QuoteDto> {
  @ValidateNested()
  public data!: QuoteDto;
}
