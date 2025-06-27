import { ValidateNested } from "class-validator";
import type { ApiResponseDto } from "../../common/types";

export class RelayResponseDto implements ApiResponseDto<object> {
  @ValidateNested()
  public data!: object;
}
