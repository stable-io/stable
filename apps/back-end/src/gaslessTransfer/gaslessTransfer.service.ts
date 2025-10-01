import { Injectable, Logger } from "@nestjs/common";
import type { Permit2GaslessData } from "@stable-io/cctp-sdk-cctpr-evm";
import {
  usdcContracts,
  evmGasToken,
  EvmGasToken,
  Usdc,
  usdc,
  Sol,
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
import {
  EvmPriceResult,
  OracleService,
  PriceResult,
  SolanaPriceResult,
} from "../oracle/oracle.service";
import { ExecutionCostService } from "../executionCost/executionCost.service";
import { QuoteDto, QuoteRequestDto, RelayRequestDto, PermitDto } from "./dto";
import type { JwtPayload, RelayTx } from "./types";
import { Conversion } from "@stable-io/amount";
import { SupportedEvmDomain } from "../common/types";
import { TransferGaslessMessage } from "@stable-io/cctp-sdk-cctpr-solana";

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

  public async quoteEvmGaslessTransfer(
    request: QuoteRequestDto<SupportedEvmDomain>,
  ): Promise<QuoteDto> {
    const gaslessFee = await this.calculateEvmGaslessFee(request);

    let permit2GaslessData: Permit2GaslessData | undefined;

    try {
      permit2GaslessData =
        await this.cctpRService.composeGaslessTransferMessage(
          request,
          gaslessFee,
        );
    } catch (error: unknown) {
      if (!(error instanceof Error)) throw error;

      if (error.message === "Transfer Amount Less or Equal to 0 After Fees") {
        permit2GaslessData = undefined;
        this.logger.log(
          `Transfer Amount Less or Equal to 0 After Fees. Amount: ${
            request.amount
          }. Gasless Fee: ${gaslessFee}. Request: ${JSON.stringify(request)}`,
        );
      } else throw error;
    }

    const jwtPayload: JwtPayload = {
      willRelay: permit2GaslessData !== undefined,
      permit2GaslessData,
      quoteRequest: instanceToPlain(request),
      gaslessFee: gaslessFee.toUnit("human").toString(),
    };

    const jwt = await this.jwtService.signAsync(jwtPayload);
    return { jwt };
  }

  public async quoteSolanaGaslessTransfer(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    request: QuoteRequestDto<"Solana">,
  ): Promise<QuoteDto> {
    await Promise.resolve();
    return { jwt: "0x1234567890abcdef" };
  }

  public async initiateEvmGaslessTransfer(
    request: RelayRequestDto<SupportedEvmDomain>,
  ): Promise<RelayTx> {
    const {
      jwt: { quoteRequest, permit2GaslessData, gaslessFee },
      permit2Signature,
      permit,
    } = request;
    const gaslessTxDetails = await this.cctpRService.gaslessTransferTx(
      quoteRequest,
      gaslessFee,
      { permit2GaslessData, permit2Signature: permit2Signature! }
    );

    const txDetails = quoteRequest.permit2PermitRequired
      ? this.multiCallWithPermit(
          gaslessTxDetails as ContractTx,
          // @note: permitSignature is guaranteed to be present in this case by validation
          permit!,
          quoteRequest,
        )
      : gaslessTxDetails as ContractTx;

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

  public async initiateSolanaGaslessTransfer(
    request: RelayRequestDto<"Solana">,
  ): Promise<RelayTx> {
    const {
      jwt: { quoteRequest },
      serializedTxBase64,
    } = request;

    const toAddress = this.cctpRService.contractAddress(quoteRequest.sourceDomain);
    const txHash = await this.txLandingService.sendTransaction(
      toAddress,
      quoteRequest.sourceDomain,
      serializedTxBase64!,
    );

    return { hash: txHash };
  }

  private async getPricesForRequest(
    request: QuoteRequestDto,
  ): Promise<PriceResult> {
    const prices = await this.oracleService.getPrices(
      [request.sourceDomain],
      request.sourceDomainNetwork,
    );
    return prices[0]!;
  }

  private async calculateEvmGaslessFee(
    request: QuoteRequestDto<SupportedEvmDomain>,
  ): Promise<Usdc> {
    const prices = (await this.getPricesForRequest(request)) as EvmPriceResult;
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

  private async calculateSolanaGaslessFee(
    request: QuoteRequestDto<"Solana">,
  ): Promise<Usdc> {
    const prices = (await this.getPricesForRequest(request)) as SolanaPriceResult;
    const solanaGasCostEstimations =
      this.executionCostService.getKnownEstimates("Solana");
    const costs = Object.entries(solanaGasCostEstimations).reduce(
      (acc, [key, value]) => {
        const gasCostInNative = prices.computationPrice.mul(value);
        const gasTokenPriceInUsdc = Conversion.from(
          prices.gasTokenPrice,
          Sol,
        );
        const usdcCost = gasCostInNative.convert(gasTokenPriceInUsdc);
        acc[key as keyof typeof solanaGasCostEstimations] = usdcCost;
        return acc;
      },
      {} as Record<keyof typeof solanaGasCostEstimations, Usdc>,
    );
    const corridorCost = ((): Usdc => {
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

    return usdc(corridorCost.toUnit("atomic"), "atomic");
  }

  private multiCallWithPermit(
    gaslessTx: ContractTx,
    permit: PermitDto,
    quoteRequest: QuoteRequestDto,
  ): ContractTx {
    const sender = quoteRequest.sender as EvmAddress;
    const usdcAddress = new EvmAddress(
      usdcContracts.contractAddressOf[this.configService.network][
        quoteRequest.sourceDomain
      ],
    );

    const permitData = encodePermitCall(
      sender,
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
