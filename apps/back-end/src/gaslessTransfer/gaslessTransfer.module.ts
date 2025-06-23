import { Module } from "@nestjs/common";
import { CctpRModule } from "../cctpr/cctpr.module";
import { TxLandingModule } from "../tx-landing/tx-landing.module";
import { ConfigModule } from "../config/config.module";
import { AuthModule } from "../auth/auth.module";
import { GaslessTransferController } from "./gaslessTransfer.controller";
import { GaslessTransferService } from "./gaslessTransfer.service";

@Module({
  imports: [CctpRModule, TxLandingModule, ConfigModule, AuthModule],
  controllers: [GaslessTransferController],
  providers: [GaslessTransferService],
  exports: [GaslessTransferService],
})
export class GaslessTransferModule {}
