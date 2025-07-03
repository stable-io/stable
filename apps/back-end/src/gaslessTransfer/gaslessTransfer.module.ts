import { Module } from "@nestjs/common";
import { CctpRModule } from "../cctpr/cctpr.module";
import { TxLandingModule } from "../txLanding/txLanding.module";
import { ConfigModule } from "../config/config.module";
import { AuthModule } from "../auth/auth.module";
import { GaslessTransferController } from "./gaslessTransfer.controller";
import { GaslessTransferService } from "./gaslessTransfer.service";
import { ValidatePermitSignatureConstraint } from "./validators";

@Module({
  imports: [CctpRModule, TxLandingModule, ConfigModule, AuthModule],
  controllers: [GaslessTransferController],
  providers: [GaslessTransferService, ValidatePermitSignatureConstraint],
  exports: [GaslessTransferService],
})
export class GaslessTransferModule {}
