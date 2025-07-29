import { ValidateNested } from "class-validator";
import type { ApiResponseDto } from "../../common/types";
import { QuoteDto } from "./quote.dto";

export class QuoteResponseDto implements ApiResponseDto<QuoteDto | null> {
  @ValidateNested()
  public data!: QuoteDto | null;
}
