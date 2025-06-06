import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

export const DEFAULT_ERROR_MESSAGE = "Something went wrong";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  public catch(error: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "";

    if (error instanceof HttpException) {
      status = error.getStatus();
      const errorResponse = error.getResponse();
      message =
        typeof errorResponse === "string"
          ? errorResponse
          : (errorResponse as Record<string, any>)["message"] ||
            (errorResponse as Record<string, any>)["error"] ||
            error.message ||
            DEFAULT_ERROR_MESSAGE;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(message, error.stack);
      message = "Internal server error";
    }

    response.status(status).json({
      statusCode: status,
      message: message || DEFAULT_ERROR_MESSAGE,
      timestamp: new Date().toISOString(),
    });
  }
}
