import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { IdentityService } from './identity.service';

@Injectable()
export class ScimGuard implements CanActivate {
  constructor(private readonly identityService: IdentityService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    await this.identityService.assertValidScimBearerToken(request.header('authorization'));
    return true;
  }
}
