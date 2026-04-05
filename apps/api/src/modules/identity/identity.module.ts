import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { IdentityController, ScimController } from './identity.controller';
import { IdentityService } from './identity.service';
import { ScimGuard } from './scim.guard';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [IdentityController, ScimController],
  providers: [IdentityService, ScimGuard],
  exports: [IdentityService]
})
export class IdentityModule {}
