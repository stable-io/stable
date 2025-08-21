import { Global, Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { ConfigService } from "./config.service";
import { envValidationConfig } from "./env.config";
import { secretsConfig } from "./secrets.config";

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      ...envValidationConfig,
      isGlobal: true,
      envFilePath: process.env["ENV_FILE_PATH"] ?? ".env",
      load: [secretsConfig],
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
