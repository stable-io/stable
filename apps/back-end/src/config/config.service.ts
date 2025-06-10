import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "./env.config";

/**
 * Custom config service to manage environment variables and static data
 * See https://docs.nestjs.com/techniques/configuration
 */
@Injectable()
export class ConfigService {
  public constructor(
    private readonly env: NestConfigService<EnvironmentVariables, true>,
  ) {}

  public get network(): EnvironmentVariables["NETWORK"] {
    return this.env.getOrThrow("NETWORK");
  }
}
