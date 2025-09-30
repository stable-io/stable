import { Injectable, Logger } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import { TxLandingClient, TxStatus, TransactionParams, SolanaTxType } from "@stable-io/tx-landing-client";
import { encoding, pollUntil } from "@stable-io/utils";
import { ConfigService } from "../config/config.service.js";
import { LoadedDomain } from "@stable-io/cctp-sdk-definitions";
import { Network } from "../common/types.js";
import { ContractTx, EvmAddress } from "@stable-io/cctp-sdk-evm";
import { SolanaAddress } from "@stable-io/cctp-sdk-solana";
import { TransferGaslessMessage } from "@stable-io/cctp-sdk-cctpr-solana";

type GetTransactionStatusResponse = Awaited<
  ReturnType<TxLandingClient["getTransactionStatus"]>
>;
type TransactionStatus = GetTransactionStatusResponse["statuses"][number];
type ConfirmedTransactionStatus = TransactionStatus & {
  status: TxStatus.TRANSACTION_STATUS_CONFIRMED;
};

// Ideally this would enforce that at least one item
// is U, which it doesn't rn.
type Some<T, U extends T> = [...(T | U)[]];

type ConfirmedTransactionStatusResponse = GetTransactionStatusResponse & {
  statuses: Some<TransactionStatus, ConfirmedTransactionStatus>;
};

@Injectable()
export class TxLandingService {
  private readonly logger = new Logger(TxLandingService.name);
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
      Codex: "Codex",
      Sonic: "Sonic",
      Worldchain: "Worldchain",
      Solana: "Solana",
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
      Codex: "Codex",
      Sonic: "Sonic",
      Worldchain: "Worldchain",
      Solana: "Solana",
    },
  } satisfies { [K in Network]: { [key in LoadedDomain]: string } };

  private readonly client!: TxLandingClient;
  constructor(private readonly configService: ConfigService) {
    this.client = new TxLandingClient(
      this.configService.txLandingUrl,
      this.configService.txLandingApiKey,
    );
  }

  public async sendTransaction(
    to: EvmAddress | SolanaAddress,
    domain: LoadedDomain,
    txDetails: ContractTx | TransferGaslessMessage,
  ): Promise<`0x${string}`> {
    const traceId = uuid();
    const transactionParams = {
      traceId,
      chain: this.toChain(domain),
      txRequests: [] as TransactionParams[],
      network: this.mappedNetwork(),
    };

    transactionParams.txRequests = domain === "Solana" ? [
        {
          type: SolanaTxType.LEGACY,
          serializedTx: Uint8Array.from("")
        },
      ] as TransactionParams[] : [
        {
          to: to.toString(),
          value: (txDetails as ContractTx).value?.toUnit("atomic") ?? 0n,
          data: encoding.hex.encode((txDetails as ContractTx).data, true),
        },
      ] as TransactionParams[];

    this.logger.log(`Sending TX to landing service with trace-id ${traceId}`);

    try {
      const r = await this.client.signAndLandTransaction(transactionParams);

      const rawTxHash = r.txResults[0]!.txHash;
      const cleanTxHash = this.extractHexFromMalformedResponse(rawTxHash);

      if (!cleanTxHash) {
        throw new Error(
          `Failed to extract valid transaction hash from API response: ${rawTxHash}`,
        );
      }

      const isConfirmedTransactionResponse = (
        result: GetTransactionStatusResponse,
      ): result is ConfirmedTransactionStatusResponse => {
        return result.statuses.some(
          (status) =>
            status.status === TxStatus.TRANSACTION_STATUS_CONFIRMED ||
            status.status === TxStatus.TRANSACTION_STATUS_FINALIZED,
        );
      };

      const confirmationResult = await pollUntil(
        () => this.client.getTransactionStatus({ traceId }),
        isConfirmedTransactionResponse,
        { baseDelayMs: 100, maxDelayMs: 350 },
      );

      const finalTxHash = confirmationResult.statuses.at(-1)!
        .txHash as `0x${string}`; // we polled until this property had a specific value.

      return finalTxHash;
    } catch (error) {
      this.logger.error("Failed to send transaction:", error);
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
  private extractHexFromMalformedResponse(
    input: string,
  ): `0x${string}` | undefined {
    // Match 0x followed by 64 hex characters (standard transaction hash length)
    const hexPattern = /0x[0-9a-f]{64}/i;
    const match = input.match(hexPattern);
    return match ? (match[0].toLowerCase() as `0x${string}`) : undefined;
  }

  private toChain(domain: LoadedDomain): string {
    const chain =
      this.cctpSdkDomainsToChains[this.configService.network][domain];
    if (!chain) {
      throw new Error(`TX LandingService: Unsupported Chain: ${domain}`);
    }
    return chain;
  }

  private mappedNetwork(): "testnet" | "mainnet" {
    return this.configService.network === "Mainnet" ? "mainnet" : "testnet";
  }
}
