import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { OpenAPIObject } from "@nestjs/swagger";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { useContainer } from "class-validator";
import { AppModule } from "./app.module";
import { MetricsAppModule } from "./metrics/metricsApp.module";
import { MetricsService } from "./metrics/metrics.service";
import { HttpExceptionFilter } from "./common/filters/httpException.filter";
import metadata from "./metadata";

const DEFAULT_PORT = 3001;
const DEFAULT_METRICS_PORT = 9090;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  const config = new DocumentBuilder()
    .setTitle("Stable")
    .setDescription("Documentation for the Stable API.")
    .setVersion("0.0")
    .build();

  await SwaggerModule.loadPluginMetadata(metadata);
  const documentFactory = (): OpenAPIObject =>
    SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, documentFactory);

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env["PORT"] ?? DEFAULT_PORT;
  await app.listen(port);
  const metricsApp = await NestFactory.create(
    MetricsAppModule.forRoot(app.get(MetricsService)),
  );

  const metricsPort = process.env["METRICS_PORT"] ?? DEFAULT_METRICS_PORT;
  await metricsApp.listen(metricsPort);
  return metricsApp;
}

void bootstrap();
