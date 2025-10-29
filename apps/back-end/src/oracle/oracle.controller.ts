// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Controller, Get, Query } from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";
import {
  EvmPriceResult,
  OracleService,
  SolanaPriceResult,
} from "./oracle.service";
import { PriceDto, PriceRequestDto, PriceResponseDto } from "./dto";
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
    const prices = await this.oracleService.getPrices([request.domain]);
    if (request.domain === "Solana") {
      const priceData = prices[0]! as SolanaPriceResult;
      return {
        data: serializeBigints({
          gasTokenPriceAtomicUsdc: priceData.gasTokenPrice.toUnit("atomic"),
          pricePerAccountByteAtomicLamports:
            priceData.pricePerAccountByte.toUnit("atomic"),
          signaturePriceAtomicLamports:
            priceData.signaturePrice.toUnit("atomic"),
          computationPriceAtomicMicroLamports:
            // WARNING: We are essentially truncating the value here.
            BigInt(priceData.computationPrice.toUnit("µlamports").toFixed(0)),
        }) as PriceDto,
      };
    }
    /* TODO: Add Sui support
    if (request.domain === "Sui") {
      const priceData = prices[0]! as SuiPriceResult;
      return {
        data: serializeBigints({
          gasTokenPriceAtomicUsdc: priceData.gasTokenPrice.toUnit("atomic"),
          computationPriceAtomicMIST: priceData.computationPrice.toUnit("MIST"),
          storagePriceAtomicMIST: priceData.storagePrice.toUnit("MIST"),
          storageRebateScalar: priceData.storageRebate.toUnit("scalar"),
        }) as PriceDto,
      };
    }
    */
    const priceData = prices[0]! as EvmPriceResult;
    return {
      data: serializeBigints({
        gasTokenPriceAtomicUsdc: priceData.gasTokenPrice.toUnit("atomic"),
        gasPriceAtomic: priceData.gasPrice.toUnit("atomic"),
      }) as PriceDto,
    };
  }
}
