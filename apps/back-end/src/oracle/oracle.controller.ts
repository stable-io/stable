import { Controller, Get, Query } from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";
import { OracleService } from "./oracle.service";
import { PriceRequestDto, PriceResponseDto, PriceDto } from "./dto";
import { serializeBigints } from "@stable-io/utils";

@Controller("oracle")
export class OracleController {
  constructor(private readonly oracleService: OracleService) {}

  @Get("/status")
  @ApiResponse({
    status: 200,
    description: "Oracle service status information",
    type: String,
  })
  public getStatus(): string {
    return this.oracleService.getStatus();
  }

  @Get("/price")
  @ApiResponse({
    status: 200,
    description:
      "Current gas token price and gas price for the specified domain",
    type: PriceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid domain parameter",
  })
  @ApiResponse({
    status: 500,
    description: "Oracle service error",
  })
  public async getPrice(
    @Query() request: PriceRequestDto,
  ): Promise<PriceResponseDto> {
    return {
      data: await this.oracleService.getPrices([request.domain], request.network)
    } as PriceResponseDto;
  }
}
