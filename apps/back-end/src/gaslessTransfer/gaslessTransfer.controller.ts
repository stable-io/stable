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
    let quote;
    try {
      quote = await this.gaslessTransferService.quoteGaslessTransfer(request);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (error.message === "Transfer Amount Less or Equal to 0 After Fees") {
        throw new BadRequestException(error.message);
      }
      throw new UnprocessableEntityException("Request could not be processed");
    }
    return {
      data: quote,
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
  @SwaggerApiResponse({
    status: 422,
    description: "Request could not be processed",
  })
  public async initiateGaslessTransfer(
    @Body() request: RelayRequestDto,
  ): Promise<RelayResponseDto> {
    let response;
    try {
      response =
        await this.gaslessTransferService.initiateGaslessTransfer(request);
    } catch {
      throw new UnprocessableEntityException("Request could not be processed");
    }
    return { data: response };
  }
}
