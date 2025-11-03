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
