import type { Network } from "@stable-io/sdk";
import { plainToInstance } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsPort,
  IsOptional,
  IsNumber,
  Min,
  validateSync,
  IsStrongPassword,
} from "class-validator";

export class EnvironmentVariables {
  @IsPort()
  @IsOptional()
  public PORT: string = "3001";

  @IsNotEmpty()
  @IsIn(["Mainnet", "Testnet"])
  public NETWORK: Network = "Mainnet";

  @IsStrongPassword({
    minLength: 32,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  public JWT_SECRET!: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  public JWT_EXPIRES_IN_SECONDS: number = 3600; // @todo: Pick a good default
}

export const validate = (
  config: Record<string, string>,
): EnvironmentVariables => {
  const validatedConfig = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
};

export const envValidationConfig = {
  validationSchema: EnvironmentVariables,
  validate,
};
