import { Controller, Get, Post } from "@nestjs/common";
import { ApiResponse as SwaggerApiResponse } from "@nestjs/swagger";

import { GaslessTransferService } from "./gaslessTransfer.service.js";
import { ApiResponse } from "../common/types.js";

import { Quote, RelayTx } from "./gaslessTransfer.types.js";

export class QuoteResponseData extends ApiResponse<Quote> {
  declare public data: Quote;
}

export class RelayResponseData extends ApiResponse<RelayTx> {
  declare public data: RelayTx;
}

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
    type: QuoteResponseData,
    description: "Quote for a gasless transfer. TODO",
  })
  public async quoteGaslessTransfer(): Promise<QuoteResponseData> {
    return { data: await this.gaslessTransferService.quoteGaslessTransfer() };
  }

  @Post("/relay")
  public async initiateGaslessTransfer(): Promise<RelayResponseData> {
    return { data: await this.gaslessTransferService.initiateGaslessTransfer() };
  }
}
