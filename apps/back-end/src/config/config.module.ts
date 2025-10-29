// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

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
