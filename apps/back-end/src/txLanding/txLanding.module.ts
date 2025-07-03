import { Module } from "@nestjs/common";
import { TxLandingService } from "./txLanding.service";

@Module({
  providers: [TxLandingService],
  exports: [TxLandingService],
})
export class TxLandingModule {}
