import { Injectable } from "@nestjs/common";
import { Size, TODO, encoding } from "@stable-io/utils";
import type {
  DomainsOf,
  Percentage,
  Usdc,
  EvmDomains,
} from "@stable-io/cctp-sdk-definitions";
import { domainsOf } from "@stable-io/cctp-sdk-definitions";
import type { Corridor } from "@stable-io/cctp-sdk-cctpr-definitions";
import { contractAddressOf as cctprContractAddressOf } from "@stable-io/cctp-sdk-cctpr-definitions";
import type {
  CorridorParams,
  Permit2GaslessData,
  SupportedEvmDomain,
} from "@stable-io/cctp-sdk-cctpr-evm";
import { CctpR, layouts } from "@stable-io/cctp-sdk-cctpr-evm";
import { ContractTx, EvmAddress } from "@stable-io/cctp-sdk-evm";
import { ConfigService } from "../config/config.service";
import { BlockchainClientService } from "../blockchainClient/blockchainClient.service";
import { QuoteRequestDto, QuoteSupportedDomain } from "../gaslessTransfer/dto/quoteRequest.dto";
import { Network } from "../common/types";
import type { ParsedSignature } from "../common/types";
import type { Permit2Nonce } from "../common/utils";
import { fetchNextPermit2Nonce, serializeSignature } from "../common/utils";

export type OnchainGaslessQuote = layouts.GaslessQuoteVariant & {
  type: "onChainUsdc";
};

@Injectable()
export class CctpRService {
  private nonceCache = Object.fromEntries(
    domainsOf("Evm").map((domain) => [domain, {}]),
  ) as Record<DomainsOf<"Evm">, Record<`0x${string}`, Permit2Nonce>>;

  constructor(
    private readonly configService: ConfigService,
    private readonly blockchainClientService: BlockchainClientService,
  ) {}

  public contractAddress<D extends keyof EvmDomains>(domain: D): EvmAddress {
    const addr = cctprContractAddressOf(this.configService.network, domain);
    if (!addr) throw new Error("CCTPR Address Not Found");
    return new EvmAddress(addr);
  }

  public async composeGaslessTransferMessage(
    quoteRequest: QuoteRequestDto,
    gaslessFee: Usdc,
  ): Promise<Permit2GaslessData> {
    if (quoteRequest.sourceDomain === "Solana") {
      throw new Error("Solana is not supported");
    } else {  
      const sender = quoteRequest.sender as EvmAddress;
      const cctpr = this.contractInterface(quoteRequest.sourceDomain);
      return cctpr.composeGaslessTransferMessage(
        quoteRequest.targetDomain,
        this.contractAddress(quoteRequest.sourceDomain),
        { amount: quoteRequest.amount, type: "in" },
        quoteRequest.recipient.toUniversalAddress(),
        quoteRequest.gasDropoff as TODO,
        this.getCorridorParams(quoteRequest.corridor, quoteRequest.fastFeeRate),
        { type: "onChain", maxRelayFee: quoteRequest.maxRelayFee },
        encoding.bignum.toBytes(
          await this.getNextNonce(quoteRequest.sourceDomain, sender),
          32 as Size,
        ),
        this.getDeadline(),
        gaslessFee,
      );
    }
  }

  public gaslessTransferTx<N extends Network>(
    quoteRequest: QuoteRequestDto<QuoteSupportedDomain<N>>,
    permit2GaslessData: Permit2GaslessData,
    permit2Signature: ParsedSignature,
    gaslessFee: Usdc,
  ): ContractTx {
    if (quoteRequest.sourceDomain === "Solana") {
      throw new Error("Solana is not supported");
    } else {  
      const sender = quoteRequest.sender as EvmAddress;
      const cctpr = this.contractInterface(quoteRequest.sourceDomain);
      return cctpr.transferGasless(
        quoteRequest.targetDomain,
        { amount: quoteRequest.amount, type: "in" },
        quoteRequest.recipient.toUniversalAddress(),
        quoteRequest.gasDropoff as TODO,
        this.getCorridorParams(quoteRequest.corridor, quoteRequest.fastFeeRate),
        { type: "onChain", maxRelayFee: quoteRequest.maxRelayFee },
        encoding.bignum.toBytes(permit2GaslessData.message.nonce, 32 as Size),
        // deadline is expressed in unix timestamp (Seconds).
        new Date(Number(permit2GaslessData.message.deadline.toString()) * 1000),
        gaslessFee,
        sender,
        serializeSignature(permit2Signature),
      );
    }
  }

  private contractInterface<D extends keyof EvmDomains>(
    domain: D,
  ): CctpR<Network, D> {
    const client = this.blockchainClientService.getClient(domain);
    return new CctpR(client);
  }

  private getDeadline(): Date {
    return new Date(Date.now() + this.configService.jwtExpiresInSeconds * 1000);
  }

  private async getNextNonce(domain: DomainsOf<"Evm">, sender: EvmAddress): Promise<Permit2Nonce> {
    const domainNonceCache = this.nonceCache[domain];
    const { client } = this.blockchainClientService.getClient(domain);

    const nonce = await fetchNextPermit2Nonce(
      client,
      sender,
      domainNonceCache[sender.toString()],
    );
    domainNonceCache[sender.toString()] = nonce;
    return nonce;
  }

  getCorridorParams(
    corridor: Exclude<Corridor, "avaxHop">,
    fastFeeRate: Percentage,
  ): CorridorParams<
    Network,
    SupportedEvmDomain<Network>,
    SupportedEvmDomain<Network>
  > {
    return corridor === "v1"
      ? { type: corridor }
      : {
          type: corridor as "v2Direct", // @todo: figure out why this is needed
          fastFeeRate: fastFeeRate,
        };
  }
}
