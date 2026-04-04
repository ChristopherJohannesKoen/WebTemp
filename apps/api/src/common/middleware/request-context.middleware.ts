import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { MetricsService } from '../../modules/observability/metrics.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(request: AuthenticatedRequest, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    const requestId = request.header('x-request-id') ?? randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    response.on('finish', () => {
      const routePath =
        request.baseUrl && request.route?.path
          ? `${request.baseUrl}${request.route.path}`
          : request.route?.path ?? request.originalUrl.split('?')[0] ?? null;

      this.metricsService.observeHttpRequest({
        method: request.method,
        route: routePath,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt
      });

      console.info(
        JSON.stringify({
          level: 'info',
          message: 'http.request',
          requestId,
          method: request.method,
          path: request.originalUrl,
          route: routePath,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
          actorId: request.currentUser?.id ?? null,
          ipAddress: request.ip ?? null,
          userAgent: request.header('user-agent') ?? null
        })
      );
    });

    next();
  }
}
