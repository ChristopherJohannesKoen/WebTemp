import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Response } from 'express';
import { AuthService } from '../../modules/auth/auth.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  async use(request: AuthenticatedRequest, response: Response, next: NextFunction) {
    const cookieName = this.configService.get<string>(
      'SESSION_COOKIE_NAME',
      'ultimate_template_session'
    );
    const token = request.cookies?.[cookieName];

    if (!token || typeof token !== 'string') {
      next();
      return;
    }

    request.sessionToken = token;
    const sessionContext = await this.authService.getSessionContextFromToken(token, {
      ipAddress: request.ip,
      userAgent: request.header('user-agent')
    });

    if (sessionContext) {
      request.currentUser = sessionContext.user;
      request.currentSession = sessionContext.session;

      if (sessionContext.rotatedToken) {
        request.sessionToken = sessionContext.rotatedToken;
        response.cookie(
          this.authService.getCookieName(),
          sessionContext.rotatedToken,
          this.authService.getCookieOptions(sessionContext.session.expiresAt)
        );
      }
    }

    next();
  }
}
