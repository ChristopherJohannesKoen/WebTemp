import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { parseAllowedOrigins } from '../config/allowed-origins';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { MetricsService } from '../../modules/observability/metrics.service';

@Injectable()
export class OriginGuardMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(request: AuthenticatedRequest, _: Response, next: NextFunction) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      next();
      return;
    }

    const isTest = process.env.NODE_ENV === 'test';
    const origin = request.header('origin');
    const referer = request.header('referer');
    const allowedOrigins = new Set(
      parseAllowedOrigins([
        process.env.APP_URL,
        process.env.API_ORIGIN,
        ...(process.env.ALLOWED_ORIGINS ?? '')
          .split(',')
          .map((allowedOrigin) => allowedOrigin.trim())
          .filter(Boolean)
      ])
    );

    if (!origin && !referer) {
      const allowMissingOriginForDev =
        process.env.NODE_ENV === 'development' &&
        process.env.ALLOW_MISSING_ORIGIN_FOR_DEV === 'true';

      if (isTest || allowMissingOriginForDev) {
        next();
        return;
      }

      this.metricsService.recordSecurityEvent('origin_missing');
      throw new ForbiddenException('Missing request origin.');
    }

    if (origin && allowedOrigins.has(origin)) {
      next();
      return;
    }

    if (referer && [...allowedOrigins].some((allowedOrigin) => referer.startsWith(allowedOrigin))) {
      next();
      return;
    }

    this.metricsService.recordSecurityEvent('origin_invalid');
    throw new ForbiddenException('Invalid request origin.');
  }
}
