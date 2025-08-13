import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { BlockchainClientService } from "./blockchainClient.service";

@Module({
  imports: [ConfigModule],
  providers: [BlockchainClientService],
  exports: [BlockchainClientService],
})
export class BlockchainClientModule {}
