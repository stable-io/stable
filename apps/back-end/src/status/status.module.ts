// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Module } from "@nestjs/common";
import { StatusController } from "./status.controller.js";
import { StatusService } from "./status.service.js";

@Module({
  controllers: [StatusController],
  providers: [StatusService],
})
export class StatusModule {}
