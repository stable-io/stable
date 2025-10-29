// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { BlockchainClientService } from "./blockchainClient.service";

@Module({
  imports: [ConfigModule],
  providers: [BlockchainClientService],
  exports: [BlockchainClientService],
})
export class BlockchainClientModule {}
