import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: AuthenticatedRequest, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    const requestId = request.header('x-request-id') ?? randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    response.on('finish', () => {
      console.info(
        JSON.stringify({
          level: 'info',
          message: 'http.request',
          requestId,
          method: request.method,
          path: request.originalUrl,
          route: request.route?.path ?? null,
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
