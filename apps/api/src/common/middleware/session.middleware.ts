import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { SessionService } from '../../modules/auth/session.service';

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly sessionService: SessionService) {}

  async use(request: AuthenticatedRequest, response: Response, next: NextFunction) {
    const cookieName = this.sessionService.getCookieName();
    const cookieValue = request.cookies?.[cookieName];

    if (!cookieValue || typeof cookieValue !== 'string') {
      next();
      return;
    }

    const token = this.sessionService.decodeSessionCookieToken(cookieValue);

    if (!token) {
      response.clearCookie(cookieName, this.sessionService.getClearCookieOptions());
      next();
      return;
    }

    request.sessionToken = token;
    const sessionContext = await this.sessionService.resolveSessionContext(token, {
      ipAddress: request.ip,
      userAgent: request.header('user-agent')
    });

    if (!sessionContext) {
      response.clearCookie(cookieName, this.sessionService.getClearCookieOptions());
      next();
      return;
    }

    this.sessionService.attachSessionToRequest(request, sessionContext);

    if (sessionContext.rotatedToken) {
      response.cookie(
        cookieName,
        this.sessionService.encodeSessionCookieToken(sessionContext.rotatedToken),
        this.sessionService.getCookieOptions(sessionContext.session.expiresAt)
      );
    }

    next();
  }
}
