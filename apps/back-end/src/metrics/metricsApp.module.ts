// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Module, DynamicModule } from "@nestjs/common";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";

@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsAppModule {
  static forRoot(externalAppMetrics?: MetricsService): DynamicModule {
    return {
      module: MetricsAppModule,
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsService,
          useValue: externalAppMetrics || new MetricsService(),
        },
      ],
    };
  }
}
