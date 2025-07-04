import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { LoggingMiddleware } from "./common/middleware/logging.middleware";
import { ConfigModule } from "./config/config.module";
import { MetricsModule } from "./metrics/metrics.module";
import { GaslessTransferModule } from "./gaslessTransfer/gaslessTransfer.module";
import { TxLandingModule } from "./txLanding/txLanding.module";
import { CctpRModule } from "./cctpr/cctpr.module";

@Module({
  imports: [
    NestConfigModule,
    ConfigModule,
    MetricsModule,
    AuthModule,
    TxLandingModule,
    CctpRModule,
    GaslessTransferModule,
  ],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggingMiddleware).forRoutes("*");
  }
}
