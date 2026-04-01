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

  async use(request: AuthenticatedRequest, _: Response, next: NextFunction) {
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
    request.currentUser = await this.authService.getSessionUserFromToken(token);
    next();
  }
}
