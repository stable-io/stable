import type { Network } from "@stable-io/cctp-sdk-definitions";
import { networks } from "@stable-io/cctp-sdk-definitions";
import { plainToInstance, Transform } from "class-transformer";
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
import { IsSolanaAddress } from "../common/validators";
import { SolanaAddress } from "@stable-io/cctp-sdk-solana";

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

  @IsSolanaAddress()
  public SOLANA_RELAYER_ADDRESS!: SolanaAddress;

  @Transform(({ value }: { value: string }) =>
    value.split(",").map((addr) => new SolanaAddress(addr)),
  )
  public NONCE_ACCOUNTS!: SolanaAddress[];
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
