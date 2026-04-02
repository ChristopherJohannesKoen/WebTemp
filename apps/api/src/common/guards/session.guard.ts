import { CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request';

export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.currentUser || !request.currentSession) {
      throw new UnauthorizedException('Authentication required.');
    }

    return true;
  }
}
