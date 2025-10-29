// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Controller, Get } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { StatusService } from "./status.service.js";

@ApiTags("status")
@Controller()
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  /**
   * Get the current status of the service
   */
  @Get()
  @ApiResponse({
    status: 200,
    description: "Service is running and healthy",
    type: String,
  })
  public getStatus(): string {
    return this.statusService.getStatus();
  }
}
