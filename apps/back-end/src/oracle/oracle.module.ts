import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { BlockchainClientModule } from "../blockchainClient/blockchainClient.module";
import { OracleController } from "./oracle.controller";
import { OracleService } from "./oracle.service";

@Module({
  imports: [ConfigModule, BlockchainClientModule],
  controllers: [OracleController],
  providers: [OracleService],
  exports: [OracleService],
})
export class OracleModule {}
