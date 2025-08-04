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