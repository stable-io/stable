import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { OpenAPIObject } from "@nestjs/swagger";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { useContainer } from "class-validator";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/httpException.filter";
import metadata from "./metadata";

const DEFAULT_PORT = 3000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Allows us to inject dependencies into custom validators
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

  await app.listen(process.env["PORT"] ?? DEFAULT_PORT);
}
void bootstrap();
