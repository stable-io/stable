import { Injectable } from '@nestjs/common';
import { Size, TODO, encoding } from "@stable-io/utils";
import type { Usdc, EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { CctpR, GaslessQuote } from "@stable-io/cctp-sdk-cctpr-evm";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { ContractTx, EvmAddress, Permit2TypedData } from "@stable-io/cctp-sdk-evm";
import { ConfigService } from '../config/config.service';
import { QuoteRequestDto } from '../gaslessTransfer/dto/quoteRequest.dto';
import { contractAddressOf as cctprContractAddressOf } from '@stable-io/cctp-sdk-cctpr-definitions';
import { Network } from '../common/types';
import { CorridorVariant } from '../../../../packages/cctp-sdk/cctpr-evm/dist/contractSdk/layouts/transfer';
import { Chain, createPublicClient, Hex, http } from "viem";
import { viemChainOf } from "@stable-io/cctp-sdk-viem";
export type OnchainGaslessQuote = GaslessQuote & { type: "onChain" };
import {
  domainsOf,
  DomainsOf,
} from "@stable-io/cctp-sdk-definitions";

import type { PlainDto } from "../common/types";
import { fetchNextPermit2Nonce, Permit2Nonce } from "../common/utils";
@Injectable()
export class CctpRService {
  private nonceCache = Object.fromEntries(
    domainsOf("Evm").map(domain => [domain, {}])
  ) as Record<DomainsOf<"Evm">, Record<Hex, Permit2Nonce>>;

  constructor(
    private readonly configService: ConfigService,
  ) {}

  public contractAddress<D extends keyof EvmDomains>(domain: D): EvmAddress {
    const addr = cctprContractAddressOf(this.configService.network, domain)
    if (!addr) throw new Error("CCTPR Address Not Found");
    return new EvmAddress(addr);
  }

  public async composeGaslessTransferMessage(
    quoteRequest: QuoteRequestDto,
    gaslessFee: Usdc,
  ): Promise<Permit2TypedData> {
    return CctpR.composeGaslessTransferMessage(
      this.configService.network,
      quoteRequest.sourceDomain,
      quoteRequest.targetDomain,
      this.contractAddress(quoteRequest.sourceDomain),
      quoteRequest.amount,
      quoteRequest.recipient.toUniversalAddress(),
      quoteRequest.gasDropoff as TODO,
      this.getCorridorParams(quoteRequest.corridor, quoteRequest.maxFastFee),
      this.getQuoteParams(quoteRequest.maxRelayFee, quoteRequest.takeFeesFromInput),
      encoding.bignum.toBytes(await this.getNextNonce(quoteRequest), 32 as Size),
      this.getDeadline(),
      gaslessFee,
    );
  }

  public gaslessTransferTx(
    quoteRequest: QuoteRequestDto,
    permit2TypedData: Permit2TypedData,
    permit2Signature: string,
    gaslessFee: Usdc,
  ): ContractTx {
    const cctpr = this.contractInterface(quoteRequest.sourceDomain);

    return cctpr.transferGasless(
      quoteRequest.targetDomain,
      quoteRequest.amount,
      quoteRequest.recipient.toUniversalAddress(),
      quoteRequest.gasDropoff as TODO,
      this.getCorridorParams(quoteRequest.corridor, quoteRequest.maxFastFee),
      this.getQuoteParams(quoteRequest.maxRelayFee, quoteRequest.takeFeesFromInput),
      encoding.bignum.toBytes(permit2TypedData.message.nonce, 32 as Size),
      // deadline is expressed in unix timestamp (Seconds).
      new Date(Number(permit2TypedData.message.deadline.toString()) * 1000),
      gaslessFee,
      quoteRequest.takeFeesFromInput,
      encoding.hex.decode(permit2Signature),
    );
  }

  private contractInterface<D extends keyof EvmDomains>(domain: D): CctpR<Network,D> {
    const cctprAddress = this.contractAddress(domain);
    const client = ViemEvmClient.fromNetworkAndDomain(this.configService.network, domain);
    return new CctpR(client, cctprAddress)
  }


  private getDeadline(): Date {
    return new Date(Date.now() + this.configService.jwtExpiresInSeconds * 1000);
  }

  private async getNextNonce(request: QuoteRequestDto): Promise<Permit2Nonce> {
    const network = this.configService.network;
    const domain = request.sourceDomain as DomainsOf<"Evm">;
    const sender = request.sender.toString();
    const domainNonceCache = this.nonceCache[domain];
    const cachedNonce = domainNonceCache[sender];
    if (cachedNonce !== undefined) {
      domainNonceCache[sender] = cachedNonce + 1n;
      return cachedNonce + 1n;
    }
    // TODO: RPC Urls? Create clients at startup?
    const client = createPublicClient({
      chain: viemChainOf[network][domain] as Chain,
      transport: http(),
    });
    const nonce = await fetchNextPermit2Nonce(client, request.sender);
    domainNonceCache[sender] = nonce;
    return nonce;
  }

  getCorridorParams(corridor: CorridorVariant["type"], maxFastFee: Usdc): CorridorVariant {
    return corridor === "v1"
      ? { type: corridor }
      : { type: corridor, maxFastFeeUsdc: maxFastFee };
  }

  getQuoteParams(maxRelayFee: Usdc, takeFeesFromInput: boolean): OnchainGaslessQuote {
    return {
      type: "onChain",
      maxRelayFee: maxRelayFee,
      takeFeesFromInput: takeFeesFromInput,
    };
  }
}