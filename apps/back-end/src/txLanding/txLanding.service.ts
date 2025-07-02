import { Injectable } from "@nestjs/common";
import { TxLandingClient } from "@stable-io/tx-landing-client";
import { encoding } from "@stable-io/utils";
import { ConfigService } from "../config/config.service.js";
import { EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { Network } from "../common/types.js";
import { ContractTx, EvmAddress } from "@stable-io/cctp-sdk-evm";

@Injectable()
export class TxLandingService {
  private readonly cctpSdkDomainsToChains = {
    Testnet: {
      Ethereum: "Sepolia",
      Avalanche: "Avalanche",
      Optimism: "OptimismSepolia",
      Arbitrum: "ArbitrumSepolia",
      Base: "BaseSepolia",
      Polygon: "PolygonSepolia",
      Unichain: "Unichain",
      Linea: "Linea",
      Codex: "",
      Sonic: "",
      Worldchain: "WorldChain",
    },
    Mainnet: {
      Ethereum: "Ethereum",
      Avalanche: "Avalanche",
      Optimism: "Optimism",
      Arbitrum: "Arbitrum",
      Base: "Base",
      Polygon: "Polygon",
      Unichain: "Unichain",
      Linea: "Linea",
      Codex: "",
      Sonic: "",
      Worldchain: "WorldChain",
    },
  } satisfies { [K in Network]: { [key in keyof EvmDomains]: string } };

  private readonly txLandingBaseUrls = {
    Mainnet: "",
    Testnet: "localhost:50051",
  } as const;

  private readonly client!: TxLandingClient;
  constructor(private readonly configService: ConfigService) {
    this.client = new TxLandingClient(
      this.txLandingBaseUrls[this.configService.network],
      this.configService.txLandingApiKey,
    );
  }

  public async sendTransaction(
    to: EvmAddress,
    domain: keyof EvmDomains,
    txDetails: ContractTx,
  ): Promise<string> {
    try {
      const r = await this.client.signAndLandTransaction({
        chain: this.toChain(domain),
        txRequests: [
          {
            to: to.toString(),
            value: txDetails.value?.toUnit("atomic") ?? 0n,
            data: encoding.hex.encode(txDetails.data, true),
          },
        ],
      });


      const rawTxHash = r.txHashes[0]!;
      const cleanTxHash = this.extractHexFromMalformedResponse(rawTxHash);
      
      if (!cleanTxHash) {
        throw new Error(`Failed to extract valid transaction hash from API response: ${rawTxHash}`);
      }

      return cleanTxHash;
    } catch (error) {
      console.error("Failed to send transaction:", error);
      throw error;
    }
  }

  /**
   * TEMPORARY WORKAROUND: Extracts a valid hex string from malformed API responses.
   * This method should be REMOVED after the transaction-landing team fixes their serialization issue.
   * 
   * @param input - The malformed string containing a hex transaction hash
   * @returns The extracted hex string with 0x prefix, or undefined if not found
   */
  private extractHexFromMalformedResponse(input: string): string | undefined {
    // Match 0x followed by 64 hex characters (standard transaction hash length)
    const hexPattern = /0x[0-9a-fA-F]{64}/i;
    const match = input.match(hexPattern);
    return match ? match[0].toLowerCase() : undefined;
  }

  private toChain(domain: keyof EvmDomains): string {
    const chain =
      this.cctpSdkDomainsToChains[this.configService.network][domain];
    if (!chain) {
      throw new Error(`TX LandingService: Unsupported Chain: ${domain}`);
    }
    return chain;
  }
}
