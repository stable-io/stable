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
} from "@stable-io/cctp-sdk-evm";

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
import { QuoteDto, QuoteRequestDto, RelayRequestDto, PermitDto } from "./dto";
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
    const gaslessFee = this.calculateGaslessFee(request);

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
      permit,
    } = request;

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
          permit!,
          quoteRequest,
        )
      : gaslessTxDetails;

    const toAddress = quoteRequest.permit2PermitRequired
      ? new EvmAddress(multicall3Address)
      : this.cctpRService.contractAddress(quoteRequest.sourceDomain);

    const txHash = await this.txLandingService.sendTransaction(
      toAddress,
      quoteRequest.sourceDomain,
      txDetails,
    );

    return { hash: txHash };
  }

  private calculateGaslessFee(request: QuoteRequestDto): Usdc {
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
    return corridorCost.add(permitCost);
  }

  private multiCallWithPermit(
    gaslessTx: ContractTx,
    permit: PermitDto,
    quoteRequest: QuoteRequestDto,
  ): ContractTx {
    const usdcAddress = new EvmAddress(
      usdcContracts.contractAddressOf[this.configService.network][
        quoteRequest.sourceDomain
      ],
    );

    const permitData = encodePermitCall(
      quoteRequest.sender,
      new EvmAddress(permit2Address),
      permit.value,
      permit.deadline,
      permit.signature,
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
    };
  }
}
