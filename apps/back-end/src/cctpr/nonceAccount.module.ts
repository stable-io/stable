import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { NonceAccountService } from "./nonceAccount.service";

@Module({
  imports: [
    ConfigModule,
  ],
  providers: [NonceAccountService],
  exports: [NonceAccountService],
})
export class NonceAccountModule {}
