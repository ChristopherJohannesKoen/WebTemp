import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DataRetentionService implements OnModuleInit {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly metricsService: MetricsService
  ) {}

  async onModuleInit() {
    await this.cleanup('startup');
  }

  @Cron('0 15 */6 * * *')
  async scheduledCleanup() {
    await this.cleanup('scheduled');
  }

  private async cleanup(source: 'startup' | 'scheduled') {
    const now = Date.now();
    const auditCutoff = this.daysAgo(this.getRetentionDays('AUDIT_LOG_RETENTION_DAYS', 365));
    const sessionCutoff = this.daysAgo(this.getRetentionDays('SESSION_RETENTION_DAYS', 30));
    const passwordResetCutoff = this.daysAgo(
      this.getRetentionDays('PASSWORD_RESET_RETENTION_DAYS', 30)
    );
    const idempotencyCutoff = this.daysAgo(this.getRetentionDays('IDEMPOTENCY_RETENTION_DAYS', 7));

    const [auditLogs, sessions, passwordResetTokens, idempotencyRecords] =
      await this.prismaService.$transaction([
        this.prismaService.auditLog.deleteMany({
          where: {
            legalHold: false,
            createdAt: {
              lt: auditCutoff
            }
          }
        }),
        this.prismaService.session.deleteMany({
          where: {
            expiresAt: {
              lt: sessionCutoff
            }
          }
        }),
        this.prismaService.passwordResetToken.deleteMany({
          where: {
            OR: [
              {
                expiresAt: {
                  lt: passwordResetCutoff
                }
              },
              {
                usedAt: {
                  lt: passwordResetCutoff
                }
              }
            ]
          }
        }),
        this.prismaService.idempotencyRequest.deleteMany({
          where: {
            expiresAt: {
              lt: idempotencyCutoff
            }
          }
        })
      ]);

    const durationMs = Date.now() - now;
    this.metricsService.recordSecurityEvent('retention_cleanup_completed');
    console.info(
      JSON.stringify({
        level: 'info',
        message: 'governance.retention_cleanup',
        source,
        durationMs,
        deleted: {
          auditLogs: auditLogs.count,
          sessions: sessions.count,
          passwordResetTokens: passwordResetTokens.count,
          idempotencyRecords: idempotencyRecords.count
        }
      })
    );

    await this.auditService.log({
      action: 'governance.retention_cleanup',
      targetType: 'retention_policy',
      targetId: source,
      eventCategory: 'configuration',
      outcome: 'success',
      metadata: {
        durationMs,
        deleted: {
          auditLogs: auditLogs.count,
          sessions: sessions.count,
          passwordResetTokens: passwordResetTokens.count,
          idempotencyRecords: idempotencyRecords.count
        }
      }
    });
  }

  private getRetentionDays(key: string, fallback: number) {
    return Number(this.configService.get<string>(key, String(fallback)));
  }

  private daysAgo(days: number) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }
}
