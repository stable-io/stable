import { Injectable } from "@nestjs/common";
import type { EvmGasToken, Usdc } from "@stable-io/cctp-sdk-definitions";
import { usdcContracts, evmGasToken } from "@stable-io/cctp-sdk-definitions";
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
import { getPrices } from "../common/utils/oracle";

@Injectable()
export class GaslessTransferService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly txLandingService: TxLandingService,
    private readonly cctpRService: CctpRService,
  ) {}

  public async quoteGaslessTransfer(
    request: QuoteRequestDto,
  ): Promise<QuoteDto> {
    const gaslessFee = await this.calculateGaslessFee(request);

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

  private async getPricesForRequest(
    request: QuoteRequestDto,
  ): Promise<{ gasTokenPrice: Usdc; gasPrice: EvmGasToken }> {
    const prices = await getPrices(
      [request.sourceDomain],
      this.configService.network,
    );
    return prices[0]!;
  }

  private async calculateGaslessFee(request: QuoteRequestDto): Promise<Usdc> {
    const prices = await this.getPricesForRequest(request);
    // TODO: Calculate these properly
    const gasCosts = {
      permit2Permit: 100000n,
      v1: 100000n,
      v2: 100000n,
    } as const;
    const costs = Object.entries(gasCosts).reduce(
      (acc, [key, value]) => {
        acc[key as keyof typeof gasCosts] = prices.gasTokenPrice.mul(
          prices.gasPrice.mul(value).toUnit("EvmGasToken"),
        );
        return acc;
      },
      {} as Record<keyof typeof gasCosts, Usdc>,
    );
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
    if (request.permit2PermitRequired)
      return corridorCost.add(costs.permit2Permit);
    return corridorCost;
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
