import { Injectable } from '@nestjs/common';
import { TxLandingClient } from "@stable-io/tx-landing-client";
import { encoding } from "@stable-io/utils";
import { ConfigService } from '../config/config.service.js';
import { EvmDomains } from '@stable-io/cctp-sdk-definitions';
import { Network } from "../common/types.js";
import { ContractTx, EvmAddress } from '@stable-io/cctp-sdk-evm';

@Injectable()
export class TxLandingService {
  private readonly cctpSdkDomainsToChains = {
    Testnet: {
      "Ethereum": "Sepolia",
      "Avalanche": "Avalanche",
      "Optimism": "OptimismSepolia",
      "Arbitrum": "ArbitrumSepolia",
      "Base": "BaseSepolia",
      "Polygon": "PolygonSepolia",
      "Unichain": "Unichain",
      "Linea": "Linea",
      "Codex": "",
      "Sonic": "",
      "Worldchain": "WorldChain",
    },
    Mainnet: {
      "Ethereum": "Ethereum",
      "Avalanche": "Avalanche",
      "Optimism": "Optimism",
      "Arbitrum": "Arbitrum",
      "Base": "Base",
      "Polygon": "Polygon",
      "Unichain": "Unichain",
      "Linea": "Linea",
      "Codex": "",
      "Sonic": "",
      "Worldchain": "WorldChain",
    }
  } satisfies { [K in Network]: { [key in keyof EvmDomains]: string } };

  private readonly txLandingBaseUrls = {
    Mainnet: "",
    Testnet: "localhost:50051",
  } as const;

  private readonly client!: TxLandingClient;
  constructor(
    private readonly configService: ConfigService,
  ) {
    this.client = new TxLandingClient(
      this.txLandingBaseUrls[this.configService.network],
      this.configService.txLandingApiKey
    );
  }

  public async sendTransaction(
    to: EvmAddress,
    domain: keyof EvmDomains,
    txDetails: ContractTx,
  ): Promise<string> {
    try {
      const { txHashes } = await this.client.signAndLandTransaction({
        chain: this.toChain(domain),
        txRequests: [
          {
            to: to.toString(),
            value: txDetails.value?.toUnit("atomic") ?? 0n,
            data: encoding.hex.encode(txDetails.data, true),
          },
        ],
      });

      return txHashes[0]!;
    } catch (error) {
      console.error("Failed to send transaction:", error);
      throw error;
    }
  }

  private toChain(domain: keyof EvmDomains): string {
    const chain = this.cctpSdkDomainsToChains[this.configService.network][domain];
    if (!chain) { throw new Error(`TX LandingService: Unsupported Chain: ${domain}`)};
    return chain;
  }
} 