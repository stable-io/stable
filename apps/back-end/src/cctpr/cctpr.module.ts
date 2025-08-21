import { Module } from "@nestjs/common";
import { BlockchainClientModule } from "../blockchainClient/blockchainClient.module";
import { CctpRService } from "./cctpr.service";

@Module({
  imports: [BlockchainClientModule],
  providers: [CctpRService],
  exports: [CctpRService],
})
export class CctpRModule {}
