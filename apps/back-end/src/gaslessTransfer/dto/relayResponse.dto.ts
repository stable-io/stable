import { ValidateNested } from "class-validator";
import { ApiResponseDto } from "../../common/types.js";

export class RelayResponseDto extends ApiResponseDto<object> {
  @ValidateNested()
  declare public data: object;
}
