import { Injectable } from "@nestjs/common";
import type { Usdc } from "@stable-io/cctp-sdk-definitions";
import { usdc } from "@stable-io/cctp-sdk-definitions";

import type { PlainDto } from "../common/types";
import { instanceToPlain } from "../common/utils";
import {
  ContractTx,
  EvmAddress,
  Permit2TypedData,
} from "@stable-io/cctp-sdk-evm";

import { JwtService } from "../auth/jwt.service";
import { ConfigService } from "../config/config.service";
import { CctpRService } from "../cctpr/cctpr.service";
import { TxLandingService } from "../txLanding/txLanding.service";
import { QuoteDto, QuoteRequestDto, RelayRequestDto } from "./dto";


export type RelayTx = {
  hash: `0x${string}`;
};

export interface JwtPayload extends Record<string, unknown> {
  readonly permit2TypedData: Permit2TypedData;
  readonly quoteRequest: PlainDto<QuoteRequestDto>;
  readonly gaslessFee: string; // Usdc =(
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

    const gaslessFee = this.calculateQuotedAmount(request);

    const jwtPayload: JwtPayload = {
      permit2TypedData: await this.cctpRService.composeGaslessTransferMessage(
        request,
        gaslessFee,
      ),
      quoteRequest: instanceToPlain(request),
      gaslessFee: gaslessFee.toUnit("human").toString(),
    };

    const jwt = await this.jwtService.signAsync(jwtPayload);
    return { jwt };
  }

  public async initiateGaslessTransfer(
    request: RelayRequestDto,
  ): Promise<RelayTx> {
    const {
      jwt: jwtPayload,
      permit2Signature,
      permitSignature,
    } = request;

    const { quoteRequest, permit2TypedData, gaslessFee } = jwtPayload;

    if (quoteRequest.permit2PermitRequired && !permitSignature) {
      // This should generate a 400, not a 500.
      throw new Error("Missing Permit for Permit2 Contract Allowance");
    }

    const gaslessTxDetails = this.cctpRService.gaslessTransferTx(
      quoteRequest,
      permit2TypedData,
      permit2Signature,
      gaslessFee,
    );

    const txDetails = quoteRequest.permit2PermitRequired
      ? this.multiCallWithPermit(gaslessTxDetails, permitSignature)
      : gaslessTxDetails;

    console.log("TX DETAILS", txDetails);

    const txHash = await this.txLandingService.sendTransaction(
      this.cctpRService.contractAddress(quoteRequest.sourceDomain),
      quoteRequest.sourceDomain,
      txDetails,
    );

    return { hash: `0x${txHash}` };
  }

  private calculateQuotedAmount(request: QuoteRequestDto): Usdc {
    // @todo: Get these dynamically
    const costs = {
      v1: usdc(0.1),
      v2: usdc(0.1),
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
    const permitCost = usdc(request.permit2PermitRequired ? 0.2 : 0);
    return request.amount.add(corridorCost).add(permitCost);
  }

  private multiCallWithPermit(gaslessTx: ContractTx, permitSignature: string): ContractTx {
    // returns a new contract transaction that wraps permit and gasless into a single tx
    // using multicall contract.
    throw new Error("Not Implemented");
  }
}
