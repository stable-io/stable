import { Injectable } from "@nestjs/common";
import type { Usdc } from "@stable-io/cctp-sdk-definitions";

import {
  usdc,
  usdcContracts,
  evmGasToken,
} from "@stable-io/cctp-sdk-definitions";
import {
  ContractTx,
  EvmAddress,
  permit2Address,
  Permit2TypedData,
} from "@stable-io/cctp-sdk-evm";

import type { ParsedSignature } from "../common/types";
import {
  instanceToPlain,
  multicall3Address,
  encodePermitCall,
  encodeAggregate3ValueCall,
  type Call3Value,
} from "../common/utils";
import { JwtService } from "../auth/jwt.service";
import { ConfigService } from "../config/config.service";
import { CctpRService } from "../cctpr/cctpr.service";
import { TxLandingService } from "../txLanding/txLanding.service";
import { QuoteDto, QuoteRequestDto, RelayRequestDto } from "./dto";
import type { JwtPayload, RelayTx } from "./types";

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
      jwt: { quoteRequest, permit2TypedData, gaslessFee },
      permit2Signature,
      permitSignature,
    } = request;

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
      ? this.multiCallWithPermit(
          gaslessTxDetails,
          // @note: permitSignature is guaranteed to be present in this case by validation
          permitSignature!,
          quoteRequest,
          permit2TypedData,
        )
      : gaslessTxDetails;

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

  private multiCallWithPermit(
    gaslessTx: ContractTx,
    permitSignature: ParsedSignature,
    quoteRequest: QuoteRequestDto,
    permit2TypedData: Permit2TypedData,
  ): ContractTx {
    const usdcAddress = new EvmAddress(
      usdcContracts.contractAddressOf[this.configService.network][
        quoteRequest.sourceDomain
      ],
    );

    const permitData = encodePermitCall(
      quoteRequest.sender,
      new EvmAddress(permit2Address),
      usdc(permit2TypedData.message.permitted.amount, "atomic"),
      new Date(Number(permit2TypedData.message.deadline) * 1000),
      permitSignature,
    );

    const calls: Call3Value[] = [
      {
        target: usdcAddress,
        allowFailure: false,
        value: evmGasToken(0),
        callData: permitData,
      },
      {
        target: gaslessTx.to,
        allowFailure: false,
        value: gaslessTx.value ?? evmGasToken(0),
        callData: gaslessTx.data,
      },
    ];

    return {
      to: new EvmAddress(multicall3Address),
      data: encodeAggregate3ValueCall(calls),
      value: gaslessTx.value,
      from: gaslessTx.from,
    };
  }
}
