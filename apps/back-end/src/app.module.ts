// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { LoggingMiddleware, MetricsMiddleware } from "./common/middleware";
import { ConfigModule } from "./config/config.module";
import { MetricsModule } from "./metrics/metrics.module";
import { GaslessTransferModule } from "./gaslessTransfer/gaslessTransfer.module";
import { TxLandingModule } from "./txLanding/txLanding.module";
import { CctpRModule } from "./cctpr/cctpr.module";
import { StatusModule } from "./status/status.module";
import { OracleModule } from "./oracle/oracle.module";
import { ExecutionCostModule } from "./executionCost/executionCost.module";
import { BlockchainClientModule } from "./blockchainClient/blockchainClient.module";

@Module({
  imports: [
    NestConfigModule,
    ConfigModule,
    BlockchainClientModule,
    MetricsModule,
    AuthModule,
    TxLandingModule,
    CctpRModule,
    GaslessTransferModule,
    StatusModule,
    OracleModule,
    ExecutionCostModule,
  ],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MetricsMiddleware, LoggingMiddleware).forRoutes("*");
  }
}
