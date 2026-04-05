import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { MetricsService } from '../../modules/observability/metrics.service';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(request: AuthenticatedRequest, _: Response, next: NextFunction) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      next();
      return;
    }

    if (!request.currentUser || !request.currentSession) {
      next();
      return;
    }

    const rawToken = request.header('x-csrf-token') ?? undefined;

    if (!rawToken) {
      this.metricsService.recordSecurityEvent('csrf_missing');
      throw new ForbiddenException('A valid CSRF token is required.');
    }

    const candidateHash = createHash('sha256').update(rawToken).digest('hex');

    if (
      candidateHash.length !== request.currentSession.csrfTokenHash.length ||
      !timingSafeEqual(
        Buffer.from(request.currentSession.csrfTokenHash),
        Buffer.from(candidateHash)
      )
    ) {
      this.metricsService.recordSecurityEvent('csrf_invalid');
      throw new ForbiddenException('A valid CSRF token is required.');
    }

    next();
  }
}
