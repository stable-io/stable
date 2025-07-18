import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiResponse as SwaggerApiResponse } from "@nestjs/swagger";
import {
  QuoteRequestDto,
  QuoteResponseDto,
  RelayRequestDto,
  RelayResponseDto,
} from "./dto";
import { GaslessTransferService } from "./gaslessTransfer.service";

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
  public async quoteGaslessTransfer(
    @Query() request: QuoteRequestDto,
  ): Promise<QuoteResponseDto> {
    return {
      data: await this.gaslessTransferService.quoteGaslessTransfer(request),
    };
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
  public async initiateGaslessTransfer(
    @Body() request: RelayRequestDto,
  ): Promise<RelayResponseDto> {
    return {
      data: await this.gaslessTransferService.initiateGaslessTransfer(request),
    };
  }
}
