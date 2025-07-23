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

@Module({
  imports: [
    NestConfigModule,
    ConfigModule,
    MetricsModule,
    AuthModule,
    TxLandingModule,
    CctpRModule,
    GaslessTransferModule,
    StatusModule,
    OracleModule,
  ],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MetricsMiddleware, LoggingMiddleware).forRoutes("*");
  }
}
