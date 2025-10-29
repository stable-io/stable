// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { BlockchainClientModule } from "../blockchainClient/blockchainClient.module";
import { OracleController } from "./oracle.controller";
import { OracleService } from "./oracle.service";

@Module({
  imports: [ConfigModule, BlockchainClientModule],
  controllers: [OracleController],
  providers: [OracleService],
  exports: [OracleService],
})
export class OracleModule {}
