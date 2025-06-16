import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigModule } from "../config/config.module";
import { MetricsModule } from "../metrics/metrics.module";
import { GaslessTransferController } from "./gaslessTransfer.controller";
import { GaslessTransferService } from "./gaslessTransfer.service";

@Module({
  imports: [MetricsModule, ConfigModule, AuthModule],
  controllers: [GaslessTransferController],
  providers: [GaslessTransferService],
})
export class GaslessTransferModule {}
