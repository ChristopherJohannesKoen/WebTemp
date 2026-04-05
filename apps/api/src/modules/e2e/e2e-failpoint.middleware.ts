import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { E2EFailpointService } from './e2e-failpoint.service';

@Injectable()
export class E2EFailpointMiddleware implements NestMiddleware {
  constructor(private readonly failpointService: E2EFailpointService) {}

  async use(request: Request, response: Response, next: NextFunction) {
    const failpoint = this.failpointService.consume(request.method, request.path);

    if (!failpoint) {
      return next();
    }

    if (failpoint.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, failpoint.delayMs));
    }

    response.status(failpoint.statusCode);

    if (!failpoint.body) {
      response.end();
      return;
    }

    response.json(failpoint.body);
  }
}
