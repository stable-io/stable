import { contractAddressOf as cctprContractAddressOf } from "@stable-io/cctp-sdk-cctpr-definitions";
import type { Usdc } from "@stable-io/cctp-sdk-definitions";
import {
  usdc,
  usdcContracts,
  chainIdOf,
} from "@stable-io/cctp-sdk-definitions";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import { Injectable } from "@nestjs/common";
<<<<<<< HEAD
import type { PlainDto } from "../common/types";
import type { Permit2TypedData } from "../common/utils";
import { composePermit2Msg, instanceToPlain } from "../common/utils";
import { JwtService } from "../auth/jwt.service";
import { ConfigService } from "../config/config.service";
import { QuoteDto, QuoteRequestDto } from "./dto";

export interface JwtPayload extends Record<string, unknown> {
  readonly permit2TypedData: Permit2TypedData;
  readonly quoteRequest: PlainDto<QuoteRequestDto>;
}
=======
import { TxLandingClient } from "@xlabs/tx-landing-client";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import { CctpR, SupportedEvmDomain } from "@stable-io/cctp-sdk-cctpr-evm";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { initiateGaslessTransfer } from "./initiateGaslessTransfer.js";

import { QuoteDto, QuoteRequestDto } from "./dto/index.js";
>>>>>>> 97ba020 (initiate transfer draft)

export type Network = "Mainnet" | "Testnet";

@Injectable()
export class GaslessTransferService {
<<<<<<< HEAD
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}
=======
  public network!: Network;
  private txLandingApiKey!: string;

  construtor(network: Network, txLandingApiKey: string) {
    this.network = network;
    this.txLandingApiKey = txLandingApiKey;
  };
>>>>>>> 97ba020 (initiate transfer draft)

  getStatus(): string {
    return "Gasless Transfer Service is running";
  }

  public async quoteGaslessTransfer(
    request: QuoteRequestDto,
  ): Promise<QuoteDto> {
    const usdcAddress = new EvmAddress(
      usdcContracts.contractAddressOf[this.configService.network][
        request.sourceDomain
      ],
    );
    const relayerContractAddress = cctprContractAddressOf(
      this.configService.network,
      request.sourceDomain,
    );
    if (!relayerContractAddress) {
      throw new Error(
        `Relayer contract address not found for source domain: ${request.sourceDomain}`,
      );
    }

    const quotedAmount = this.calculateQuotedAmount(request);
    const nonce = this.getNonce();
    const deadline = this.getDeadline();

    const jwtPayload: JwtPayload = {
      permit2TypedData: composePermit2Msg(
        chainIdOf(this.configService.network, request.sourceDomain),
        usdcAddress,
        quotedAmount,
        nonce,
        deadline,
      ),
      quoteRequest: instanceToPlain(request),
    };

    const jwt = await this.jwtService.signAsync(jwtPayload);
    return { jwt };
  }

<<<<<<< HEAD
  public initiateGaslessTransfer(): Promise<object> {
    // @todo: verify quote signature and throw if invalid
    // @todo: call tx-landing-service and request the tx to be landed. set nonce+sender as
    //    the transaction tracking id.
    // @todo: poll tx-landing-service for transaction confirmation
    // @todo: respond.
    return Promise.resolve({});
=======
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
>>>>>>> 97ba020 (initiate transfer draft)
  }

  private calculateQuotedAmount(request: QuoteRequestDto): Usdc {
    // @todo: Get these dynamically
    const costs = {
      v1: usdc(1_000_000),
      v2: usdc(2_000_000),
    } as const;
    const corridorCost = ((): Usdc => {
      switch (request.corridor) {
        case "v1":
          return costs.v1;
        case "v2Direct":
          return costs.v2;
        case "avaxHop":
          return costs.v2.add(costs.v1);
        default:
          throw new Error(`Invalid corridor: ${request.corridor}`);
      }
    })();
    const permitCost = usdc(request.permit2PermitRequired ? 300_000 : 0);
    return request.amount.add(corridorCost).add(permitCost);
  }

  private getDeadline(): Date {
    return new Date(Date.now() + this.configService.jwtExpiresInSeconds * 1000);
  }

  private getNonce(): bigint {
    // @todo: Add a stable offset
    // @todo: Query permit2 contract to find a free nonce
    // @todo: Cache latest nonce per user?
    return 0n;
  }
}
