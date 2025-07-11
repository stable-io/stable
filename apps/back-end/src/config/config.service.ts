import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "./env.config";
import type { SecretsVariables } from "./secrets.config";

type ConfigVariables = EnvironmentVariables & SecretsVariables;

/**
 * Custom config service to manage environment variables and static data
 * See https://docs.nestjs.com/techniques/configuration
 */
@Injectable()
export class ConfigService {
  public constructor(
    private readonly env: NestConfigService<ConfigVariables, true>,
  ) {}

  public get port(): EnvironmentVariables["PORT"] {
    return this.env.getOrThrow("PORT");
  }

  public get network(): EnvironmentVariables["NETWORK"] {
    return this.env.getOrThrow("NETWORK");
  }

  public get jwtExpiresInSeconds(): EnvironmentVariables["JWT_EXPIRES_IN_SECONDS"] {
    return this.env.getOrThrow("JWT_EXPIRES_IN_SECONDS");
  }

  // SECRETS (loaded from configuration factory)

  public get jwtSecret(): SecretsVariables["jwtSecret"] {
    return this.env.getOrThrow("jwtSecret");
  }

  public get txLandingApiKey(): SecretsVariables["txLandingApiKey"] {
    return this.env.getOrThrow("txLandingApiKey");
  }
}
