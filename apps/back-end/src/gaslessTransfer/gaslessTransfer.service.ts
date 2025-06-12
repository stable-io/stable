import { Injectable } from "@nestjs/common";
import { TxLandingClient } from "@xlabs/tx-landing-client";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import { CctpR, SupportedEvmDomain } from "@stable-io/cctp-sdk-cctpr-evm";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { initiateGaslessTransfer } from "./initiateGaslessTransfer.js";

import { QuoteDto, QuoteRequestDto } from "./dto/index.js";

export type Network = "Mainnet" | "Testnet";

@Injectable()
export class GaslessTransferService {
  public network!: Network;
  private txLandingApiKey!: string;

  construtor(network: Network, txLandingApiKey: string) {
    this.network = network;
    this.txLandingApiKey = txLandingApiKey;
  };

  getStatus(): string {
    return "Gasless Transfer Service is running";
  }

  public quoteGaslessTransfer(request: QuoteRequestDto): Promise<QuoteDto> {
    // @todo:
    // 1. quote transfer based on input parameters
    // 2. sign the quote
    // 3. respond
    return Promise.resolve({ foo: "bar" });
  }

  public initiateGaslessTransfer = initiateGaslessTransfer({
    getCctprEvm: this.getCctprEvm.bind(this),
    getTxLandingClient: () => this.txLandingClient(),
  });

  private txLandingClient(): TxLandingClient {
    const txLandingBaseUrls = {
      Mainnet: "",
      Testnet: "http://localhost:50051",
    };

    const url = txLandingBaseUrls[this.network];
    return new TxLandingClient(url, this.txLandingApiKey, {
      timeout: 60, // seconds
    });
  }

  private getCctprEvm(sourceChain: keyof EvmDomains): CctpR<Network, SupportedEvmDomain<Network>> {
    const client = ViemEvmClient.fromNetworkAndDomain(this.network, sourceChain);
    const cctprAddress = "0xTODO";

    return new CctpR(client, new EvmAddress(cctprAddress));
  }
}
