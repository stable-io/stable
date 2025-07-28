import { Controller, Get, Param, HttpException, HttpStatus } from "@nestjs/common";
import { ApiResponse as SwaggerApiResponse, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Platform } from "@stable-io/cctp-sdk-definitions";
import { serializeBigints, SerializedBigint } from "@stable-io/utils";
import type { ApiResponseDto } from "../common/types";
import { ExecutionCostService } from "./executionCost.service";
import type { EvmExecutionCosts } from "./executionCost.service";


type EvmExecutionCostDto = Record<keyof EvmExecutionCosts, SerializedBigint>;
@Controller("execution-cost")
export class ExecutionCostController {
  constructor(
    private readonly executionCostService: ExecutionCostService,
  ) {}

  /**
   * Get execution cost estimates for a specific platform
   */
  @Get("/:platform")
  @ApiParam({
    name: "platform",
    description: "The blockchain platform to get execution costs for",
    enum: ["Evm"],
    example: "Evm"
  })
  @SwaggerApiResponse({
    status: 200,
    description: "Execution cost estimates for the specified platform",
    schema: {
      type: "object",
      properties: {
        permit: {
          type: "string",
          description: "Gas cost for permit operations",
          example: "20081"
        },
        multiCall: {
          type: "string", 
          description: "Gas cost for multicall operations",
          example: "74321"
        },
        v1: {
          type: "string",
          description: "Gas cost for v1 transfers",
          example: "160505"
        },
        v2: {
          type: "string",
          description: "Gas cost for v2 transfers",
          example: "170148"
        },
        v1Gasless: {
          type: "string",
          description: "Gas cost for v1 gasless transfers", 
          example: "179257"
        },
        v2Gasless: {
          type: "string",
          description: "Gas cost for v2 gasless transfers",
          example: "188439"
        }
      }
    }
  })
  @SwaggerApiResponse({
    status: 400,
    description: "Invalid or unsupported platform parameter",
  })
  public getExecutionCosts(@Param("platform") platform: string): ApiResponseDto<
    EvmExecutionCostDto
  > {
    const supportedPlatforms = this.executionCostService.getSupportedPlatforms();
    if (!supportedPlatforms.includes(platform as Platform)) {
      throw new HttpException(
        `Unsupported platform: ${platform}. Supported platforms: ${supportedPlatforms.join(", ")}`,
        HttpStatus.BAD_REQUEST
      );
    }

    const result = this.executionCostService.getKnownEstimates(platform as Platform);
    if (!result) {
      throw new HttpException(
        `No execution cost estimates available for platform: ${platform}`,
        HttpStatus.BAD_REQUEST
      );
    }

    return { data: serializeBigints(result) as Record<keyof EvmExecutionCosts, SerializedBigint> };
  }
} 