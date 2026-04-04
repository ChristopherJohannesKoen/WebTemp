import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { SessionService } from '../../modules/auth/session.service';

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly sessionService: SessionService) {}

  async use(request: AuthenticatedRequest, response: Response, next: NextFunction) {
    const cookieName = this.sessionService.getCookieName();
    const token = request.cookies?.[cookieName];

    if (!token || typeof token !== 'string') {
      next();
      return;
    }

    request.sessionToken = token;
    const sessionContext = await this.sessionService.resolveSessionContext(token, {
      ipAddress: request.ip,
      userAgent: request.header('user-agent')
    });

    if (!sessionContext) {
      next();
      return;
    }

    this.sessionService.attachSessionToRequest(request, sessionContext);

    if (sessionContext.rotatedToken) {
      response.cookie(
        cookieName,
        sessionContext.rotatedToken,
        this.sessionService.getCookieOptions(sessionContext.session.expiresAt)
      );
    }

    next();
  }
}
