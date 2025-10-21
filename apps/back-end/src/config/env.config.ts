import type { Network } from "@stable-io/cctp-sdk-definitions";
import { networks } from "@stable-io/cctp-sdk-definitions";
import { plainToInstance } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsPort,
  IsOptional,
  IsNumber,
  Min,
  validateSync,
  IsString,
} from "class-validator";

export class EnvironmentVariables {
  @IsPort()
  @IsOptional()
  public PORT: string = "4000";

  @IsNotEmpty()
  @IsIn(networks)
  public NETWORK: Network = networks[0];

  @IsNumber()
  @Min(1)
  @IsOptional()
  public JWT_EXPIRES_IN_SECONDS: number = 3600; // @todo: Pick a good default

  @IsNotEmpty()
  @IsString()
  public TX_LANDING_URL!: string;

  @IsString()
  public SOLANA_RELAYER_ADDRESS!: string;

  @IsString()
  public NONCE_ACCOUNT!: string;

  @IsString()
  public GASLESS_PRIVATE_KEY!: string;
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
