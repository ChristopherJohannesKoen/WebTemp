import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly intervalName = 'idempotency-cleanup';

  constructor(
    private readonly idempotencyService: IdempotencyService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry
  ) {}

  async onModuleInit() {
    await this.runCleanup('startup');

    const interval = setInterval(() => {
      void this.runCleanup('scheduled');
    }, this.getCleanupIntervalMs());

    this.schedulerRegistry.addInterval(this.intervalName, interval);
  }

  onModuleDestroy() {
    if (this.schedulerRegistry.doesExist('interval', this.intervalName)) {
      this.schedulerRegistry.deleteInterval(this.intervalName);
    }
  }

  private async runCleanup(source: 'startup' | 'scheduled') {
    try {
      await this.idempotencyService.cleanupExpiredRequests(source);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'idempotency.cleanup_failed',
          source,
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack
                }
              : String(error)
        })
      );
    }
  }

  private getCleanupIntervalMs() {
    return Number(
      this.configService.get<string>('IDEMPOTENCY_CLEANUP_INTERVAL_MS', '900000')
    );
  }
}
