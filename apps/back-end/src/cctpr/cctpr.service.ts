import { Injectable } from "@nestjs/common";
import { Size, TODO, encoding } from "@stable-io/utils";
import type {
  DomainsOf,
  Percentage,
  Usdc,
  EvmDomains,
  LoadedDomain,
  PlatformOf,
} from "@stable-io/cctp-sdk-definitions";
import { domainsOf } from "@stable-io/cctp-sdk-definitions";
import type { Corridor, SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";
import { contractAddressOf as cctprContractAddressOf } from "@stable-io/cctp-sdk-cctpr-definitions";
import type {
  CorridorParams,
  Permit2GaslessData,
  SupportedEvmDomain,
} from "@stable-io/cctp-sdk-cctpr-evm";
import { CctpR as EvmCctpR, layouts } from "@stable-io/cctp-sdk-cctpr-evm";
import { CctpR as SolanaCctpR } from "@stable-io/cctp-sdk-cctpr-solana";
import { ContractTx, EvmAddress, EvmClient } from "@stable-io/cctp-sdk-evm";
import { ConfigService } from "../config/config.service";
import { BlockchainClientService } from "../blockchainClient/blockchainClient.service";
import {
  QuoteRequestDto,
  QuoteSupportedDomain,
} from "../gaslessTransfer/dto/quoteRequest.dto";
import { Network } from "../common/types";
import type { ParsedSignature, SupportedBackendEvmDomain } from "../common/types";
import type { Permit2Nonce } from "../common/utils";
import { fetchNextPermit2Nonce, serializeSignature } from "../common/utils";
import { SolanaAddress } from "@stable-io/cctp-sdk-solana";
import { ForeignDomain } from "../../../../packages/cctp-sdk/cctpr-solana/dist/contractSdk/constants";
import { PublicClient } from "viem";
import type {
  Base64EncodedBytes,
  TransactionMessage,
} from "@solana/kit";
import { compileTransaction, ReadonlyUint8Array } from "@solana/kit";
import type { SignableEncodedBase64Message } from "@stable-io/cctp-sdk-cctpr-solana";

export type OnchainGaslessQuote = layouts.GaslessQuoteVariant & {
  type: "onChainUsdc";
};

export type EvmGaslessOpts = { permit2GaslessData: Permit2GaslessData, permit2Signature: ParsedSignature };
export type SolanaGaslessOpts = { deadline: bigint };

@Injectable()
export class CctpRService {
  private nonceCache = Object.fromEntries(
    domainsOf("Evm").map((domain) => [domain, {}]),
  ) as Record<DomainsOf<"Evm">, Record<`0x${string}`, Permit2Nonce>>;

  constructor(
    private readonly configService: ConfigService,
    private readonly blockchainClientService: BlockchainClientService,
  ) {}

  public contractAddress<D extends LoadedDomain>(domain: D): EvmAddress | SolanaAddress {
    const addr = cctprContractAddressOf(this.configService.network, domain);
    if (!addr) throw new Error("CCTPR Address Not Found");
    return domain === 'Solana' ? new SolanaAddress(addr) : new EvmAddress(addr);
  }

  public async composeEvmGaslessTransferMessage(
    quoteRequest: QuoteRequestDto<SupportedBackendEvmDomain>,
    gaslessFee: Usdc,
  ): Promise<Permit2GaslessData> {
      const sender = quoteRequest.sender as EvmAddress;
      const cctpr = this.contractInterface(quoteRequest.sourceDomain) as EvmCctpR<Network, keyof EvmDomains>;
      return cctpr.composeGaslessTransferMessage(
        quoteRequest.targetDomain,
        this.contractAddress(quoteRequest.sourceDomain) as EvmAddress,
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

  public async composeSolanaGaslessTransferMessage(
    quoteRequest: QuoteRequestDto<"Solana">,
    gaslessFee: Usdc,
  ): Promise<SignableEncodedBase64Message> {
    const sender = quoteRequest.sender as SolanaAddress;
    const cctpr = this.contractInterface(quoteRequest.sourceDomain) as SolanaCctpR<Network>;
    const targetDomain = quoteRequest.targetDomain as Exclude<SupportedDomain<Network>, "Solana">;
    const nonceAccount = new SolanaAddress(await this.configService.nonceAccount);
    const relayer = new SolanaAddress(await this.configService.solanaRelayerAddress);
    const tx = await cctpr.transferGasless(
      targetDomain,
      { amount: quoteRequest.amount, type: "in" },
      quoteRequest.recipient.toUniversalAddress(),
      // TODO: Check this gasDropoff
      quoteRequest.gasDropoff as TODO,
      this.getCorridorParams(quoteRequest.corridor, quoteRequest.fastFeeRate),
      { type: "onChain", maxRelayFee: quoteRequest.maxRelayFee },
      sender,
      // TODO: Check this deadline
      this.getDeadline(),
      gaslessFee,
      relayer,
      nonceAccount,
    );
    // WARNING TODO FIXME: We probably need to sign the message here
    // This way we don't need to check the data at relay
    const messageBytes = compileTransaction(tx).messageBytes as ReadonlyUint8Array as Uint8Array;
    const solanaMessage = encoding.base64.encode(messageBytes) as Base64EncodedBytes;
    return { solanaMessage };
  }

  public async gaslessTransferTx<N extends Network>(
    quoteRequest: QuoteRequestDto<QuoteSupportedDomain<N>>,
    gaslessFee: Usdc,
    opts: EvmGaslessOpts | SolanaGaslessOpts, 
  ): Promise<ContractTx | TransactionMessage> {
    if (quoteRequest.sourceDomain === "Solana") {
      if (!("deadline" in (opts as SolanaGaslessOpts))) throw new Error("Deadline is required for Solana");

      const sender = quoteRequest.sender as SolanaAddress;
      const cctpr = this.contractInterface(quoteRequest.sourceDomain) as SolanaCctpR<Network>;
      const relayer = this.configService.solanaRelayerAddress;
      const nonceAccount = this.configService.nonceAccount;
      return await cctpr.transferGasless(
        quoteRequest.targetDomain as ForeignDomain<Network>,
        { amount: quoteRequest.amount, type: "in" },
        quoteRequest.recipient.toUniversalAddress(),
        quoteRequest.gasDropoff as TODO,
        this.getCorridorParams(quoteRequest.corridor, quoteRequest.fastFeeRate),
        { type: "onChain", maxRelayFee: quoteRequest.maxRelayFee },
        sender,
        // deadline is expressed in unix timestamp (Seconds).
        new Date(Number((opts as SolanaGaslessOpts).deadline.toString()) * 1000),
        gaslessFee,
        relayer,
        nonceAccount        
      );
    } else {
      if (!("permit2GaslessData" in (opts as EvmGaslessOpts))) throw new Error("Permit2GaslessData is required for Evm");
      if (!("permit2Signature" in (opts as EvmGaslessOpts))) throw new Error("Permit2Signature is required for Evm");
      
      const { permit2GaslessData, permit2Signature } = opts as EvmGaslessOpts;
      const sender = quoteRequest.sender as EvmAddress;
      const cctpr = this.contractInterface(quoteRequest.sourceDomain) as EvmCctpR<Network, keyof EvmDomains>;
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

  private contractInterface<D extends SupportedDomain<Network>>(
    domain: D,
  ): EvmCctpR<Network, Exclude<D, "Solana">> | SolanaCctpR<Network> {
    const client = this.blockchainClientService.getClient(domain);

    if (domain === "Solana")
      return new SolanaCctpR(client.network, client as TODO, {});

    return new EvmCctpR(client as EvmClient) as EvmCctpR<Network, Exclude<D, "Solana">>;
  }

  private getDeadline(): Date {
    return new Date(Date.now() + this.configService.jwtExpiresInSeconds * 1000);
  }

  private async getNextNonce(
    domain: DomainsOf<"Evm">,
    sender: EvmAddress,
  ): Promise<Permit2Nonce> {
    const domainNonceCache = this.nonceCache[domain];
    const { client } = this.blockchainClientService.getClient(domain);

    const nonce = await fetchNextPermit2Nonce(
      client as PublicClient,
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
