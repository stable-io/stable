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
import { SupportedBackendEvmDomain } from "../common/types";
import {
  Base64EncodedBytes,
  getTransactionDecoder,
  getCompiledTransactionMessageDecoder,
  decompileTransactionMessage,
} from "@solana/kit";
import { SignableEncodedBase64Message } from "@stable-io/cctp-sdk-cctpr-solana";
import { SolanaAddress } from "@stable-io/cctp-sdk-solana";
import { NonceAccountService } from "../cctpr/nonceAccount.service";

@Injectable()
export class GaslessTransferService {
  public static readonly minimumGaslessFee = usdc("0.000001");

  private readonly logger = new Logger(GaslessTransferService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly txLandingService: TxLandingService,
    private readonly cctpRService: CctpRService,
    private readonly oracleService: OracleService,
    private readonly executionCostService: ExecutionCostService,
    private readonly nonceAccountService: NonceAccountService,
  ) {}

  public async quoteEvmGaslessTransfer(
    request: QuoteRequestDto<SupportedBackendEvmDomain>,
  ): Promise<QuoteDto> {
    const gaslessFee = await this.calculateEvmGaslessFee(request);

    let permit2GaslessData: Permit2GaslessData | undefined;

    try {
      permit2GaslessData =
        await this.cctpRService.composeEvmGaslessTransferMessage(
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
    request: QuoteRequestDto<"Solana">,
  ): Promise<QuoteDto> {
    const gaslessFee = await this.calculateSolanaGaslessFee(request);
    let encodedTx: SignableEncodedBase64Message | undefined;

    try {
      encodedTx = await this.cctpRService.composeSolanaGaslessTransferMessage(
        request,
        gaslessFee,
      );
    } catch (error: unknown) {
      if (!(error instanceof Error)) throw error;

      if (error.message === "Transfer Amount Less or Equal to 0 After Fees") {
        encodedTx = undefined;
        this.logger.log(
          `Transfer Amount Less or Equal to 0 After Fees. Amount: ${
            request.amount
          }. Gasless Fee: ${gaslessFee}. Request: ${JSON.stringify(request)}`,
        );
      } else throw error;
    }

    const jwtPayload: JwtPayload = {
      willRelay: encodedTx !== undefined,
      encodedTx,
      quoteRequest: instanceToPlain(request),
      gaslessFee: gaslessFee.toUnit("human").toString(),
    };

    const jwt = await this.jwtService.signAsync(jwtPayload);
    return { jwt };
  }

  public async initiateEvmGaslessTransfer(
    request: RelayRequestDto<SupportedBackendEvmDomain>,
  ): Promise<RelayTx> {
    const {
      jwt: { quoteRequest, permit2GaslessData, gaslessFee },
      permit2Signature,
      permit,
    } = request;

    if (permit2GaslessData === undefined)
      throw new Error("No permit2 gasless data in relay request");

    const gaslessTxDetails = this.cctpRService.evmGaslessTransferTx(
      quoteRequest,
      gaslessFee,
      { permit2GaslessData, permit2Signature: permit2Signature! },
    );

    const contractTx = quoteRequest.permit2PermitRequired
      ? this.multiCallWithPermit(
          gaslessTxDetails,
          // @note: permitSignature is guaranteed to be present in this case by validation
          permit!,
          quoteRequest,
        )
      : gaslessTxDetails;

    const toAddress = quoteRequest.permit2PermitRequired
      ? new EvmAddress(multicall3Address)
      : (this.cctpRService.contractAddress(
          quoteRequest.sourceDomain,
        ) as EvmAddress);

    const txHash = await this.txLandingService.sendTransaction(
      quoteRequest.sourceDomain,
      { to: toAddress, tx: contractTx },
    );

    return { hash: txHash };
  }

  public async initiateSolanaGaslessTransfer(
    request: RelayRequestDto<"Solana">,
  ): Promise<RelayTx> {
    const {
      jwt: { quoteRequest, encodedTx: quoteTx },
      encodedTx: signedTx,
    } = request;

    const decodedQuoteTx = getTransactionDecoder().decode(
      Buffer.from(
        (quoteTx as SignableEncodedBase64Message).encodedSolanaTx,
        "base64",
      ),
    );
    const decodedSignedtx = getTransactionDecoder().decode(
      Buffer.from(
        (signedTx as SignableEncodedBase64Message).encodedSolanaTx,
        "base64",
      ),
    );

    const quoteMessageBytes = Buffer.from(decodedQuoteTx.messageBytes).toString(
      "hex",
    );
    const signedMessageBytes = Buffer.from(
      decodedSignedtx.messageBytes,
    ).toString("hex");
    // TODO: We should remove this check and just send the user signature and add it to the transaction message
    if (quoteMessageBytes !== signedMessageBytes)
      throw new Error(
        "Signed transaction does not match the original transaction",
      );

    const compiledMessage = getCompiledTransactionMessageDecoder().decode(
      decodedQuoteTx.messageBytes,
    );
    const decodedMessage = decompileTransactionMessage(compiledMessage);
    const nonceAccount = new SolanaAddress(
      decodedMessage.instructions[0].accounts![0].address,
    );
    // WARNING: This is essentially a race between users that got a quote around the same time
    this.nonceAccountService.blockNonceAccount(nonceAccount);

    try {
      const hash = await this.txLandingService.sendTransaction(
        quoteRequest.sourceDomain,
        signedTx?.encodedSolanaTx as Base64EncodedBytes,
        this.configService.solanaRelayerAddress.toString(),
      );
      return { hash };
    } finally {
      this.nonceAccountService.unblockNonceAccount(nonceAccount);
    }
  }

  private async getPricesForRequest(
    request: QuoteRequestDto,
  ): Promise<PriceResult> {
    const prices = await this.oracleService.getPrices([request.sourceDomain]);
    return prices[0]!;
  }

  private async calculateEvmGaslessFee(
    request: QuoteRequestDto<SupportedBackendEvmDomain>,
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
        let usdcCost = gasCostInNative.convert(gasTokenPriceInUsdc);
        if (usdcCost.lt(GaslessTransferService.minimumGaslessFee))
          usdcCost = GaslessTransferService.minimumGaslessFee;
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
    const prices = (await this.getPricesForRequest(
      request,
    )) as SolanaPriceResult;
    const solanaGasCostEstimations =
      this.executionCostService.getKnownEstimates("Solana");
    const costs = Object.entries(solanaGasCostEstimations).reduce(
      (acc, [key, value]) => {
        // TODO: Maybe make a generic function in solana utils
        const gasCostInNative = prices.computationPrice.mul(
          value.computationUnits,
        );
        const signatureCostInNative = prices.signaturePrice.mul(
          value.signatures,
        );
        const accountCostInNative = prices.pricePerAccountByte.mul(
          value.accountBytes,
        );
        const totalCostInNative = gasCostInNative
          .add(signatureCostInNative)
          .add(accountCostInNative);
        const gasTokenPriceInUsdc = Conversion.from(prices.gasTokenPrice, Sol);
        const usdcCost = totalCostInNative.convert(gasTokenPriceInUsdc);
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
