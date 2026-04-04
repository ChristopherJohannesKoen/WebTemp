import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

@Module({
  imports: [AuditModule, IdempotencyModule],
  controllers: [AuthController],
  providers: [AuthService, SessionService],
  exports: [AuthService, SessionService]
})
export class AuthModule {}
