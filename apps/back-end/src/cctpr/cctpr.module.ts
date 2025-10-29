// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Module } from "@nestjs/common";
import { CctpRService } from "./cctpr.service";
import { BlockchainClientModule } from "../blockchainClient/blockchainClient.module";
import { TxLandingModule } from "../txLanding/txLanding.module";
import { ConfigModule } from "../config/config.module";
import { NonceAccountModule } from "./nonceAccount.module";

@Module({
  imports: [
    BlockchainClientModule,
    TxLandingModule,
    ConfigModule,
    NonceAccountModule,
  ],
  providers: [CctpRService],
  exports: [CctpRService],
})
export class CctpRModule {}
