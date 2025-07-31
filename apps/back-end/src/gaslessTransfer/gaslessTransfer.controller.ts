import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  BadRequestException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ApiResponse as SwaggerApiResponse } from "@nestjs/swagger";
import {
  QuoteRequestDto,
  QuoteResponseDto,
  RelayRequestDto,
  RelayResponseDto,
} from "./dto";
import { GaslessTransferService } from "./gaslessTransfer.service";
import { SupportedEvmDomain } from "../common/types";

@Controller("gasless-transfer")
export class GaslessTransferController {
  constructor(
    private readonly gaslessTransferService: GaslessTransferService,
  ) {}

  /**
   * Generate a quote for a gasless transfer
   */
  @Get("/quote")
  @SwaggerApiResponse({
    status: 200,
    type: QuoteResponseDto,
    description: "Quote for gasless transfer with fee estimates and timing",
  })
  @SwaggerApiResponse({
    status: 400,
    description: "Invalid request parameters",
  })
  @SwaggerApiResponse({
    status: 422,
    description: "Request could not be processed",
  })
  public async quoteGaslessTransfer(
    @Query() request: QuoteRequestDto,
  ): Promise<QuoteResponseDto> {
    const data = request.sourceDomain === "Solana"
    ? await this.gaslessTransferService.quoteSolanaGaslessTransfer(
        request as QuoteRequestDto<"Solana">
      )
    : await this.gaslessTransferService.quoteEvmGaslessTransfer(
        request as QuoteRequestDto<SupportedEvmDomain>
      );
    return { data };
  }

  @Post("/relay")
  @SwaggerApiResponse({
    status: 201,
    description: "Transfer initiated successfully",
    type: RelayResponseDto,
  })
  @SwaggerApiResponse({
    status: 400,
    description: "Invalid request parameters or JWT validation failed",
  })
  @SwaggerApiResponse({
    status: 422,
    description: "Request could not be processed",
  })
  public async initiateGaslessTransfer(
    @Body() request: RelayRequestDto,
  ): Promise<RelayResponseDto> {
    const data = request.jwt.quoteRequest.sourceDomain === "Solana"
      ? await this.gaslessTransferService.initiateSolanaGaslessTransfer(
          request as RelayRequestDto<"Solana">
        )
      : await this.gaslessTransferService.initiateEvmGaslessTransfer(
          request as RelayRequestDto<SupportedEvmDomain>
        );
    return { data };
  }
}
