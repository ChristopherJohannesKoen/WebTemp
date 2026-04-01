import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class OriginGuardMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(request: AuthenticatedRequest, _: Response, next: NextFunction) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      next();
      return;
    }

    const isTest = this.configService.get<string>('NODE_ENV') === 'test';
    const origin = request.header('origin');
    const referer = request.header('referer');
    const allowedOrigins = new Set(
      [
        this.configService.get<string>('APP_URL'),
        this.configService.get<string>('API_ORIGIN')
      ].filter((value): value is string => Boolean(value))
    );

    if (!origin && !referer) {
      if (isTest || this.configService.get<string>('NODE_ENV') !== 'production') {
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
