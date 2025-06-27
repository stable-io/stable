import { Controller, Get, Post, Query } from "@nestjs/common";
import { ApiResponse as SwaggerApiResponse } from "@nestjs/swagger";
import { QuoteRequestDto, QuoteResponseDto, RelayResponseDto } from "./dto";
import { GaslessTransferService } from "./gaslessTransfer.service";

@Controller("gasless-transfer")
export class GaslessTransferController {
  constructor(
    private readonly gaslessTransferService: GaslessTransferService,
  ) {}

  /**
   * Get the current status of the gasless transfer service
   */
  @Get("/status")
  @SwaggerApiResponse({
    status: 200,
    description: "Service status information",
    type: String,
  })
  public getStatus(): string {
    return this.gaslessTransferService.getStatus();
  }

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
  public async initiateGaslessTransfer(): Promise<RelayResponseDto> {
    return {
      data: await this.gaslessTransferService.initiateGaslessTransfer(),
    };
  }
}
