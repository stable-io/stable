import { Injectable, Logger } from "@nestjs/common";
import type { EvmDomains, Network } from "@stable-io/cctp-sdk-definitions";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import type { Url } from "@stable-io/utils";
import { ConfigService } from "../config/config.service";

export type BlockchainClient<
  N extends Network,
  D extends keyof EvmDomains,
> = ViemEvmClient<N, D>;

@Injectable()
export class BlockchainClientService {
  private readonly logger = new Logger(BlockchainClientService.name);
  private readonly clients = new Map<
    keyof EvmDomains,
    BlockchainClient<Network, keyof EvmDomains>
  >();

  constructor(private readonly configService: ConfigService) {}

  getClient<D extends keyof EvmDomains>(
    domain: D,
  ): BlockchainClient<typeof this.configService.network, D> {
    const { network } = this.configService;

    if (this.clients.has(domain)) {
      return this.clients.get(domain) as BlockchainClient<typeof network, D>;
    }

    const rpcUrl = this.configService.getRpcUrl(domain);

    if (rpcUrl) {
      this.logger.debug(
        `Creating client for ${network}/${domain} with custom RPC: ${rpcUrl}`,
      );
    } else {
      this.logger.debug(
        `Creating client for ${network}/${domain} with default RPC`,
      );
    }

    const client = ViemEvmClient.fromNetworkAndDomain<typeof network, D>(
      network,
      domain,
      rpcUrl as Url | undefined,
    );
    this.clients.set(
      domain,
      client as ViemEvmClient<typeof network, keyof EvmDomains>,
    );

    return client;
  }
}
