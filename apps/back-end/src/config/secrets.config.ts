import { readFileSync } from "node:fs";
import path from "node:path";
import { plainToInstance } from "class-transformer";
import {
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  validateSync,
} from "class-validator";

export class SecretsVariables {
  @IsStrongPassword({
    minLength: 32,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  public jwtSecret!: string;

  @IsNotEmpty()
  @IsString()
  public txLandingApiKey!: string;
}

const validateSecrets = (config: Record<string, string>): SecretsVariables => {
  const validatedConfig = plainToInstance(SecretsVariables, config);
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
};

/**
 * Configuration factory for reading secrets from disk
 * Follows Docker secrets pattern: /run/secrets/<secret_name>
 * Falls back to environment variables if files don't exist
 */
export const secretsConfig = () => {
  const secretsPath = process.env["SECRETS_PATH"] || "/run/secrets";

  const readSecretFromFile = (
    secretName: string,
    envVarName: string,
  ): string => {
    const filePath = path.join(secretsPath, secretName);

    let secret;
    try {
      secret = readFileSync(`/${secretsPath}/${secretName}`, "utf8").trim();
    } catch {
      console.info("Secrets not found. Defaulting to env vars.");
    }

    if (!secret) {
      secret = process.env[envVarName];
    }

    if (!secret) {
      throw new Error(
        `Secret '${secretName}' not found in file '${filePath}' or environment variable '${envVarName}'`,
      );
    }

    return secret;
  };

  const jwtSecret = readSecretFromFile("jwt_secret", "JWT_SECRET");
  const txLandingApiKey = readSecretFromFile(
    "tx_landing_api_key",
    "TX_LANDING_API_KEY",
  );

  // Validate secrets using class validator pattern
  const validatedSecrets = validateSecrets({
    jwtSecret,
    txLandingApiKey,
  });

  return validatedSecrets;
};

export type Secrets = ReturnType<typeof secretsConfig>;
