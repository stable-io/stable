// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Controller, Get, Header } from "@nestjs/common";
import { ApiExcludeController, ApiResponse } from "@nestjs/swagger";
import { MetricsService } from "./metrics.service";

@ApiExcludeController()
@Controller("metrics")
export class MetricsController {
  public constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  @ApiResponse({
    status: 200,
    type: String,
    description: "Returns prometheus metrics",
  })
  public getMetrics(): Promise<string> {
    return this.metricsService.getReport();
  }
}
