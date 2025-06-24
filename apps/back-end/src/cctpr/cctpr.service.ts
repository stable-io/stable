import { Injectable } from '@nestjs/common';
import { Size, TODO, encoding } from "@stable-io/utils";
import type { Usdc } from "@stable-io/cctp-sdk-definitions";
import { CctpR, GaslessQuote } from "@stable-io/cctp-sdk-cctpr-evm";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { ContractTx, EvmAddress, Permit2TypedData } from "@stable-io/cctp-sdk-evm";
import { ConfigService } from '../config/config.service';
import { QuoteRequestDto } from '../gaslessTransfer/dto/quoteRequest.dto';
import { contractAddressOf as cctprContractAddressOf } from '@stable-io/cctp-sdk-cctpr-definitions';

@Injectable()
export class CctpRService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  public gaslessTransferTx(
    quoteRequest: QuoteRequestDto,
    permit2TypedData: Permit2TypedData,
    permit2Signature: string,
    gaslessFee: Usdc,
    maxRelayFee: Usdc,
    maxFastFeeUsdc: Usdc,
    takeFeesFromInput: boolean,
  ): ContractTx {
    const client = ViemEvmClient.fromNetworkAndDomain(this.configService.network, quoteRequest.sourceDomain);

    const cctprAddress = cctprContractAddressOf(this.configService.network, quoteRequest.sourceDomain);

    const cctpr = new CctpR(client, cctprAddress);

    const corridor = quoteRequest.corridor === "v1"
      ? { type: quoteRequest.corridor }
      : { type: quoteRequest.corridor, maxFastFeeUsdc };
    const quote: GaslessQuote & { type: "onChain" } = {
      type: "onChain",
      maxRelayFee: maxRelayFee,
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