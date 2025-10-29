// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

const HTTP_ERROR_STATUS = 400;

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  public use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const startTime = Date.now();

    this.logger.log(`Incoming ${method} ${originalUrl}`);

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      const logMessage = `${method} ${originalUrl} ${String(statusCode)} - ${String(duration)}ms`;

      if (statusCode >= HTTP_ERROR_STATUS) {
        this.logger.error(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}
