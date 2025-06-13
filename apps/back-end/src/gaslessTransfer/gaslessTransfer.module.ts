import { Module } from "@nestjs/common";
import { GaslessTransferService } from "./gaslessTransfer.service";
import { GaslessTransferController } from "./gaslessTransfer.controller";
import { MetricsModule } from "../metrics/metrics.module";
import { ConfigModule } from "../config/config.module";

@Module({
  imports: [MetricsModule, ConfigModule],
  controllers: [GaslessTransferController],
  providers: [GaslessTransferService],
})
export class GaslessTransferModule {}
