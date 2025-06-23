import { Injectable } from '@nestjs/common';
import { Size, TODO, encoding } from "@stable-io/utils";
import { Usdc } from "@stable-io/cctp-sdk-definitions";
import { CctpR, SupportedEvmDomain, GaslessQuote } from "@stable-io/cctp-sdk-cctpr-evm";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { ContractTx, EvmAddress, Permit2TypedData } from "@stable-io/cctp-sdk-evm";
import { usdc } from "@stable-io/cctp-sdk-definitions";
import type { Network, RelayTx } from '../gaslessTransfer/gaslessTransfer.service.js';
import { ConfigService } from '../config/config.service.js';
import { QuoteRequestDto } from '../gaslessTransfer/dto/quoteRequest.dto';
import { contractAddressOf as cctprContractAddressOf } from '@stable-io/cctp-sdk-cctpr-definitions';

@Injectable()
export class CctpRService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  public async gaslessTransferTx(
    quoteRequest: QuoteRequestDto,
    permit2TypedData: Permit2TypedData,
    permit2Signature: string,
    gaslessFee: Usdc,
    takeFeesFromInput: boolean,
    permitSignature?: string,
  ): Promise<ContractTx> {
    const client = ViemEvmClient.fromNetworkAndDomain(this.configService.network, quoteRequest.sourceDomain);
    
    const cctprAddress = cctprContractAddressOf(this.configService.network, quoteRequest.sourceDomain);

    if (!cctprAddress) throw new Error("CCTPR Address Not Found");

    const cctpr = new CctpR(client, new EvmAddress(cctprAddress));

    const corridor = { type: "v1" as const };
    const quote: GaslessQuote & { type: "onChain" } = {
      type: "onChain",
      maxRelayFee: usdc("0.1"),
      takeFeesFromInput,
    };

    return cctpr.transferGasless(
      quoteRequest.targetDomain,
      quoteRequest.amount,
      quoteRequest.recipient.toUniversalAddress(),
      quoteRequest.gasDropoff as TODO,
      corridor,
      quote,
      encoding.bignum.toBytes(permit2TypedData.message.nonce, 32 as Size),
      new Date(Number(permit2TypedData.message.deadline.toString())),
      gaslessFee,
      takeFeesFromInput,
      encoding.hex.decode(permit2Signature),
    );
  }
} 