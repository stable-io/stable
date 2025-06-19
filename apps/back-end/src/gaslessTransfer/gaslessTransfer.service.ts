import { contractAddressOf as cctprContractAddressOf } from "@stable-io/cctp-sdk-cctpr-definitions";
import type { Usdc } from "@stable-io/cctp-sdk-definitions";
import {
  usdc,
  usdcContracts,
  chainIdOf,
} from "@stable-io/cctp-sdk-definitions";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import { Injectable } from "@nestjs/common";
import { encoding } from "@stable-io/utils";

import type { PlainDto } from "../common/types";
import type { Permit2TypedData } from "../common/utils";
import { composePermit2Msg, instanceToPlain } from "../common/utils";
import { JwtService } from "../auth/jwt.service";
import { ConfigService } from "../config/config.service";
import { TxLandingService } from "../tx-landing/tx-landing.service";
import { CctpRService } from "../cctpr/cctpr.service";
import { QuoteDto, QuoteRequestDto } from "./dto";
import type { InitiateTransferParams, RelayTx } from "./initiateGaslessTransfer.js";

export interface JwtPayload extends Record<string, unknown> {
  readonly permit2TypedData: Permit2TypedData;
  readonly quoteRequest: PlainDto<QuoteRequestDto>;
}

export type Network = "Mainnet" | "Testnet";

@Injectable()
export class GaslessTransferService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly txLandingService: TxLandingService,
    private readonly cctpRService: CctpRService,
  ) {}

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

  public async initiateGaslessTransfer(transferParams: InitiateTransferParams): Promise<RelayTx> {
    const cctprEvm = this.cctpRService.getCctprEvm(transferParams.sourceChain);
    const client = this.txLandingService.getClient();

    const txDetails = cctprEvm.transferGasless(
      transferParams.targetChain,
      transferParams.inputAmount,
      transferParams.mintRecipient,
      transferParams.gasDropoff,
      transferParams.corridor,
      transferParams.quote,
      transferParams.nonce,
      transferParams.deadline,
      transferParams.gaslessFee,
      transferParams.takeFeesFromInput,
      transferParams.permit2Signature,
    );

    const cctprAddress = "0xTODO";

    const { txHashes } = await client.signAndLandTransaction({
      chain: transferParams.targetChain,
      txRequests: [{
        to: cctprAddress,
        value: txDetails.value?.toUnit("atomic") ?? 0n,
        data: encoding.hex.encode(txDetails.data, true),
      }],
    });

    // fire some metric?

    // 4. respond.
    // return txHashes[0];

    throw new Error("Not Fully Implemented");
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
