import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { instanceToPlain } from "class-transformer";
import type { PlainDto } from "../common/types.js";
import { ConfigService } from "../config/config.service";
import { QuoteDto, QuoteRequestDto } from "./dto/index.js";

export interface TokenPermissions {
  readonly token: string;
  readonly amount: string;
}

export interface Permit {
  readonly permitted: TokenPermissions;
  readonly nonce: string;
  readonly deadline: string;
}

export interface TransferDetails {
  readonly to: string;
  readonly requestedAmount: string;
}

export interface Permit2PermitPayload {
  readonly permit: Permit;
  readonly transferDetails: TransferDetails;
  readonly owner: string;
}

export interface JwtPayload {
  readonly permit2PermitPayload: Permit2PermitPayload;
  readonly quoteRequest: PlainDto<QuoteRequestDto>;
}

@Injectable()
export class GaslessTransferService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  getStatus(): string {
    return "Gasless Transfer Service is running";
  }

  public async quoteGaslessTransfer(
    request: QuoteRequestDto,
  ): Promise<QuoteDto> {
    // @todo: use actual values
    const usdcAddress = "0xA0b86a33E6441B8fA2CA8DC22B8c5c9AB5D4e88B";
    const relayerContractAddress = "0x742d35Cc6634C0532925a3b8D404d4bC2f28e9FF";
    const quotedAmount = "1000000";
    const nonce = "0";
    const deadline = Math.floor(
      Date.now() / 1000 + this.configService.jwtExpiresInSeconds,
    ).toString();

    const jwtPayload: JwtPayload = {
      permit2PermitPayload: {
        permit: {
          permitted: {
            token: usdcAddress,
            amount: quotedAmount,
          },
          nonce,
          deadline,
        },
        transferDetails: {
          to: relayerContractAddress,
          requestedAmount: quotedAmount,
        },
        owner: request.sender.toString(),
      },
             quoteRequest: instanceToPlain(request) as PlainDto<QuoteRequestDto>,
    };

    const permit2PermitJwt = await this.jwtService.signAsync(jwtPayload);

    return { permit2PermitJwt };
  }

  public initiateGaslessTransfer(): Promise<object> {
    // 1. verify quote signature and throw if invalid
    // 2. call tx-landing-service and request the tx to be landed. set nonce+sender as the
    //    transaction tracking id.
    // 3. poll tx-landing-service for transaction confirmation
    // 4. respond.
    return Promise.resolve({});
  }
}
