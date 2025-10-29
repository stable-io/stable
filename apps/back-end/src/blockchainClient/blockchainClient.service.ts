// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Injectable, Logger } from "@nestjs/common";
import type { EvmDomains, Network } from "@stable-io/cctp-sdk-definitions";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import type { Url } from "@stable-io/utils";
import { ConfigService } from "../config/config.service";
import { SolanaKitClient } from "@stable-io/cctp-sdk-solana-kit";
import { SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";

export type BlockchainClient<
  N extends Network,
  D extends SupportedDomain<N>,
> = ViemEvmClient<N, Exclude<D, "Solana">> | SolanaKitClient<N>;

@Injectable()
export class BlockchainClientService {
  private readonly logger = new Logger(BlockchainClientService.name);
  private readonly clients = new Map<
    SupportedDomain<Network>,
    BlockchainClient<Network, SupportedDomain<Network>>
  >();

  constructor(private readonly configService: ConfigService) {}

  getClient<D extends SupportedDomain<Network>>(
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

    let client;
    if (domain === "Solana") {
      client = SolanaKitClient.fromNetworkAndDomain(
        network,
        domain,
        rpcUrl as Url | undefined,
      );
      this.clients.set(domain, client);
    }
    else {
      client = ViemEvmClient.fromNetworkAndDomain<typeof network, Exclude<D, "Solana">>(
        network,
        domain as Exclude<D, "Solana">,
        rpcUrl as Url | undefined,
      );
      this.clients.set(
        domain,
        client as ViemEvmClient<typeof network, keyof EvmDomains>,
      );
    }

    return client;
  }
}
