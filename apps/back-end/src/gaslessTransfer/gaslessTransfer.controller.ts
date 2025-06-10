import { Controller, Get, Post } from "@nestjs/common";
import { ApiResponse as SwaggerApiResponse } from "@nestjs/swagger";
import { QuoteResponseDto, RelayResponseDto } from "./dto/index.js";
import { GaslessTransferService } from "./gaslessTransfer.service.js";

@Controller("gasless-transfer")
export class GaslessTransferController {
  constructor(
    private readonly gaslessTransferService: GaslessTransferService,
  ) {}

  @Get("/status")
  public getStatus(): string {
    return this.gaslessTransferService.getStatus();
  }

  @Get("/quote")
  @SwaggerApiResponse({
    status: 200,
    type: QuoteResponseDto,
    description: "Quote for a gasless transfer. TODO",
  })
  public async quoteGaslessTransfer(): Promise<QuoteResponseDto> {
    return { data: await this.gaslessTransferService.quoteGaslessTransfer() };
  }

  @Post("/relay")
  public async initiateGaslessTransfer(): Promise<RelayResponseDto> {
    return { data: await this.gaslessTransferService.initiateGaslessTransfer() };
  }
}
