import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { AuthService } from '../../modules/auth/auth.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  use(request: AuthenticatedRequest, _: Response, next: NextFunction) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      next();
      return;
    }

    if (!request.currentUser || !request.currentSession) {
      next();
      return;
    }

    this.authService.assertCsrfToken(
      request.currentSession,
      request.header('x-csrf-token') ?? undefined
    );

    next();
  }
}
