import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { parseAllowedOrigins } from '../config/allowed-origins';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class OriginGuardMiddleware implements NestMiddleware {
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
      if (isTest || process.env.NODE_ENV !== 'production') {
        next();
        return;
      }

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

    throw new ForbiddenException('Invalid request origin.');
  }
}
