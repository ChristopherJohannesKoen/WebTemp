import { Module } from '@nestjs/common';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';

@Module({
  providers: [IdempotencyService, IdempotencyCleanupService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor]
})
export class IdempotencyModule {}
