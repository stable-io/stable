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
import { EvmPriceResult, getPrices, PriceResult } from "../common/utils/oracle";
import { SupportedEvmDomain } from "../common/types";

@Injectable()
export class GaslessTransferService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly txLandingService: TxLandingService,
    private readonly cctpRService: CctpRService,
  ) {}

  public async quoteEvmGaslessTransfer(
    request: QuoteRequestDto<SupportedEvmDomain>,
  ): Promise<QuoteDto> {
    const gaslessFee = await this.calculateEvmGaslessFee(request);

    const jwtPayload: JwtPayload = {
      permit2GaslessData: await this.cctpRService.composeGaslessTransferMessage(
        request,
        gaslessFee,
      ),
      quoteRequest: instanceToPlain(request),
      gaslessFee: gaslessFee.toUnit("human").toString(),
    };

    const jwt = await this.jwtService.signAsync(jwtPayload);
    return { jwt };
  }

  public async quoteSolanaGaslessTransfer(
    request: QuoteRequestDto<"Solana">,
  ): Promise<QuoteDto> {
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
    const gaslessTxDetails = this.cctpRService.gaslessTransferTx(
      quoteRequest,
      permit2GaslessData,
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

  public async initiateSolanaGaslessTransfer(
    request: RelayRequestDto<"Solana">,
  ): Promise<RelayTx> {
    return { hash: "0x1234567890abcdef" };
  }

  private async getPricesForRequest(
    request: QuoteRequestDto<SupportedEvmDomain>,
  ): Promise<EvmPriceResult> {
    const prices = await getPrices(
      [request.sourceDomain],
      this.configService.network,
    );
    return prices[0] as EvmPriceResult;
  }

  private async calculateEvmGaslessFee(
    request: QuoteRequestDto<SupportedEvmDomain>
  ): Promise<Usdc> {
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
