import { Injectable, Logger } from "@nestjs/common";
import {
  usdcContracts,
  evmGasToken,
  EvmGasToken,
  Usdc,
  usdc,
} from "@stable-io/cctp-sdk-definitions";
import {
  ContractTx,
  EvmAddress,
  permit2Address,
  Permit2TypedData,
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
import { OracleService } from "../oracle/oracle.service";
import { ExecutionCostService } from "../executionCost/executionCost.service";
import { QuoteDto, QuoteRequestDto, RelayRequestDto, PermitDto } from "./dto";
import type { JwtPayload, RelayTx } from "./types";
import { Conversion } from "@stable-io/amount";

@Injectable()
export class GaslessTransferService {
  private readonly logger = new Logger(GaslessTransferService.name);
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly txLandingService: TxLandingService,
    private readonly cctpRService: CctpRService,
    private readonly oracleService: OracleService,
    private readonly executionCostService: ExecutionCostService,
  ) {}

  public async quoteGaslessTransfer(
    request: QuoteRequestDto,
  ): Promise<QuoteDto> {
    const gaslessFee = await this.calculateGaslessFee(request);

    let permit2TypedData: Permit2TypedData | undefined;

    try {
      permit2TypedData = await this.cctpRService.composeGaslessTransferMessage(
        request,
        gaslessFee,
      );
    } catch (error: unknown) {
      if (!(error instanceof Error)) throw error;

      if (error.message === "Transfer Amount Less or Equal to 0 After Fees") {
        permit2TypedData = undefined;
        this.logger.log(
          `Transfer Amount Less or Equal to 0 After Fees. Amount: ${request.amount
          }. Gasless Fee: ${gaslessFee}`
        )
      }

      else throw error;
    }

    const jwtPayload: JwtPayload = {
      willRelay: permit2TypedData !== undefined,
      permit2TypedData,
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

  private async getPricesForRequest(
    request: QuoteRequestDto,
  ): Promise<{ gasTokenPrice: Usdc; gasPrice: EvmGasToken }> {
    const prices = await this.oracleService.getPrices([request.sourceDomain]);
    return prices[0]!;
  }

  private async calculateGaslessFee(request: QuoteRequestDto): Promise<Usdc> {
    const prices = await this.getPricesForRequest(request);
    const evmGasCostEstimations =
      this.executionCostService.getKnownEstimates("Evm");
    const costs = Object.entries(evmGasCostEstimations).reduce(
      (acc, [key, value]) => {
        const gasCostInNative = prices.gasPrice.mul(value);
        const gasTokenPriceInUsdc = Conversion.from(
          prices.gasTokenPrice,
          EvmGasToken,
        );
        const usdcCost = gasCostInNative.convert(gasTokenPriceInUsdc);
        acc[key as keyof typeof evmGasCostEstimations] = usdcCost;
        return acc;
      },
      {} as Record<keyof typeof evmGasCostEstimations, Usdc>,
    );
    let corridorCost = ((): Usdc => {
      switch (request.corridor) {
        case "v1":
          return costs.v1Gasless;
        case "v2Direct":
          return costs.v2Gasless;
        // case "avaxHop":
        // return costs.v2Gasless;
        default:
          throw new Error(`Invalid corridor: ${request.corridor}`);
      }
    })();
    if (request.permit2PermitRequired)
      corridorCost = corridorCost.add(costs.permit).add(costs.multiCall);
    return usdc(corridorCost.toUnit("atomic"), "atomic");
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
