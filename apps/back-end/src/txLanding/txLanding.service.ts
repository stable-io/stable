import { Injectable, Logger } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import { TxLandingClient, TxStatus, TransactionParams } from "@stable-io/tx-landing-client";
import { encoding, pollUntil } from "@stable-io/utils";
import { ConfigService } from "../config/config.service.js";
import { LoadedDomain } from "@stable-io/cctp-sdk-definitions";
import { Network } from "../common/types.js";
import { ContractTx, EvmAddress } from "@stable-io/cctp-sdk-evm";
import { SolanaAddress } from "@stable-io/cctp-sdk-solana";
import { Base64EncodedBytes } from "@solana/kit";

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
      Sei: "Sei",
      BNB: "BNB",
      XDC: "XDC",
      HyperEVM: "HyperEVM",
      Ink: "Ink",
      Plume: "Plume",
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
      Sei: "Sei",
      BNB: "BNB",
      XDC: "XDC",
      HyperEVM: "HyperEVM",
      Ink: "Ink",
      Plume: "Plume",
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
    domain: LoadedDomain,
    txDetails: { to: EvmAddress, tx: ContractTx } | Base64EncodedBytes,
    sender?: string,
  ): Promise<string> {
    const traceId = uuid();
    const transactionParams = {
      traceId,
      chain: this.toChain(domain),
      txRequests: [] as TransactionParams[],
      network: this.mappedNetwork(),
      ...(sender ? { walletQuery: { address: sender } } : {}),
    };

    transactionParams.txRequests = this.buildTxRequests(domain, txDetails);

    this.logger.log(`Sending TX to landing service with trace-id ${traceId}`);
    try {
      const r = await this.client.signAndLandTransaction(transactionParams);

      if (domain !== "Solana") {
        const rawTxHash = r.txResults[0]!.txHash;
        const cleanTxHash = this.extractHexFromMalformedResponse(rawTxHash);
        if (!cleanTxHash)
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
        .txHash as string; // we polled until this property had a specific value.

      return finalTxHash;
    } catch (error) {
      this.logger.error("Failed to send transaction:", error);
      throw error;
    }
  }

  public async signTransaction(    
    domain: LoadedDomain,
    txDetails: { to: EvmAddress, tx: ContractTx } | Base64EncodedBytes,
    signer?: string,
  ): Promise<string[]> {
    const traceId = uuid();
    const transactionParams = {
      traceId,
      chain: this.toChain(domain),
      txRequests: [] as TransactionParams[],
      network: this.mappedNetwork(),
      ...(signer ? { walletQuery: { address: signer } } : {}),
    };

    transactionParams.txRequests = this.buildTxRequests(domain, txDetails);

    this.logger.log(`Sending TX to landing service with trace-id ${traceId}`);
    try {
      const response = await this.client.signTransaction(transactionParams);

      return response.signatures;
    } catch (error) {
      this.logger.error("Failed to send transaction:", error);
      throw error;
    }
  }

  private buildTxRequests(
    domain: LoadedDomain,
    txDetails: { to: EvmAddress, tx: ContractTx } | Base64EncodedBytes,
  ): TransactionParams[] {
    if (domain === "Solana") {
      return [
        {
          type: "legacy",
          serializedTx: Buffer.from(txDetails as Base64EncodedBytes, 'base64'),
        },
      ] as TransactionParams[];
    }
    const { to, tx } = txDetails as { to: EvmAddress, tx: ContractTx };
    return [
      {
        to: to.toString(),
        value: tx.value?.toUnit("atomic") ?? 0n,
        data: encoding.hex.encode(tx.data, true),
      },
    ] as TransactionParams[];
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
