import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import { plainToInstance } from "class-transformer";
import type { Network } from "@stable-io/cctp-sdk-definitions";
import { domainsOf } from "@stable-io/cctp-sdk-definitions";
import type { EnvironmentVariables } from "./env.config";
import type { SecretsVariables } from "./secrets.config";
import type { RpcUrlConfig } from "./rpc";
import { RpcConfigDto, validateRpcConfig } from "./rpc";
import { SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";

type ConfigVariables = EnvironmentVariables & SecretsVariables;

/**
 * Custom config service to manage environment variables and static data
 * See https://docs.nestjs.com/techniques/configuration
 */
@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private readonly rpcUrlConfig: RpcUrlConfig;

  public constructor(
    private readonly env: NestConfigService<ConfigVariables, true>,
  ) {
    this.rpcUrlConfig = this.loadRpcUrlConfig();
  }

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

  public get txLandingUrl(): EnvironmentVariables["TX_LANDING_URL"] {
    return this.env.getOrThrow("TX_LANDING_URL");
  }

  public get solanaRelayerAddress(): EnvironmentVariables["SOLANA_RELAYER_ADDRESS"] {
    return this.env.getOrThrow("SOLANA_RELAYER_ADDRESS");
  }

  public get nonceAccounts(): EnvironmentVariables["NONCE_ACCOUNTS"] {
    return this.env.getOrThrow("NONCE_ACCOUNTS");
  }

  public getRpcUrl<D extends SupportedDomain<Network>>(domain: D): string | undefined {
    return this.rpcUrlConfig[this.network][domain];
  }

  private loadRpcUrlConfig(): RpcUrlConfig {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const configPath = path.join(currentDir, "../../config/rpc-urls.json");

    if (!existsSync(configPath)) {
      this.logger.warn(
        `RPC config file not found at ${configPath}. Using default RPC endpoints. ` +
          `Copy config/rpc-urls.example.json to config/rpc-urls.json to customize.`,
      );
      return this.getDefaultRpcConfig();
    }

    try {
      const configContent = readFileSync(configPath, "utf8");
      const configData = JSON.parse(configContent);
      const config = plainToInstance(RpcConfigDto, configData);
      const validation = validateRpcConfig(config);

      if (!validation.isValid) {
        throw new Error(validation.errors.join(", "));
      }

      this.logger.log("RPC configuration loaded successfully");
      return config as RpcUrlConfig;
    } catch (error) {
      this.logger.error("Failed to load RPC configuration:", error);
      this.logger.warn("Falling back to default RPC endpoints");
      return this.getDefaultRpcConfig();
    }
  }

  private getDefaultRpcConfig(): RpcUrlConfig {
    const domains = ["Solana"].concat(domainsOf("Evm"));
    return {
      Mainnet: Object.fromEntries(
        domains.map((domain) => [domain, undefined]),
      ),
      Testnet: Object.fromEntries(
        domains.map((domain) => [domain, undefined]),
      ),
    };
  }
}
