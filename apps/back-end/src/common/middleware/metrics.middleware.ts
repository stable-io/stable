import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { MetricsService } from "../../metrics/metrics.service.js";

const HEALTH_CHECK_ROUTES = ["/status"];

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  public use(req: Request, res: Response, next: NextFunction): void {
    if (this.isHealthCheckRoute(req.originalUrl)) {
      next();
      return;
    }

    const startTime = Date.now();
    const method = req.method;
    const path = this.normalizeRoute(req.originalUrl);

    this.metricsService.gauge("http_requests_active", { method, path }, 1);

    res.on("finish", () => {
      const duration = (Date.now() - startTime) / 1000;
      const statusCode = res.statusCode.toString();

      this.metricsService.counter(
        "http_requests_total",
        { method, path, status_code: statusCode },
        1,
      );

      this.metricsService.histogram(
        "http_request_duration_seconds",
        { method, path, status_code: statusCode },
        duration,
      );

      if (statusCode.startsWith("4") || statusCode.startsWith("5")) {
        this.metricsService.counter(
          "http_requests_errors_total",
          { method, path, status_code: statusCode },
          1,
        );
      }

      this.metricsService.gauge("http_requests_active", { method, path }, -1);
    });

    next();
  }

  private isHealthCheckRoute(url: string): boolean {
    return HEALTH_CHECK_ROUTES.some((route) => url.includes(route));
  }

  private normalizeRoute(url: string): string {
    const path = url.split("?")[0] ?? "";
    return (
      path
        .replace(/^\//, "")
        .replaceAll("/", "_")
        .replaceAll("-", "_")
        .toLowerCase() || "root"
    );
  }
}
