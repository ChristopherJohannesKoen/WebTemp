import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { AuditEventCategory, AuditOutcome, SessionAuthMethod } from '@packages/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';

function isSerializableConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2034';
  }

  return error instanceof Prisma.PrismaClientUnknownRequestError;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContextService: RequestContextService
  ) {}

  async log(input: {
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    eventCategory?: AuditEventCategory;
    outcome?: AuditOutcome;
    authMechanism?: SessionAuthMethod | null;
    legalHold?: boolean;
    metadata?: Record<string, unknown> | null;
  }) {
    const requestContext = this.requestContextService.get();
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.prismaService.$transaction(
          async (transaction) => {
            const previousEntry = await transaction.auditLog.findFirst({
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              select: { entryHash: true }
            });

            const entryPayload = JSON.stringify({
              actorId: input.actorId ?? requestContext?.actorId ?? null,
              action: input.action,
              targetType: input.targetType,
              targetId: input.targetId ?? null,
              eventCategory: input.eventCategory ?? 'application',
              outcome: input.outcome ?? 'success',
              authMechanism: input.authMechanism ?? requestContext?.authMechanism ?? null,
              requestId: requestContext?.requestId ?? null,
              ipAddress: requestContext?.ipAddress ?? null,
              userAgent: requestContext?.userAgent ?? null,
              metadata: input.metadata ?? null,
              previousHash: previousEntry?.entryHash ?? null
            });

            const entryHash = createHash('sha256').update(entryPayload).digest('hex');

            await transaction.auditLog.create({
              data: {
                actorId: input.actorId ?? requestContext?.actorId ?? null,
                action: input.action,
                targetType: input.targetType,
                targetId: input.targetId ?? null,
                eventCategory: input.eventCategory ?? 'application',
                outcome: input.outcome ?? 'success',
                authMechanism: input.authMechanism ?? requestContext?.authMechanism ?? null,
                requestId: requestContext?.requestId ?? null,
                ipAddress: requestContext?.ipAddress ?? null,
                userAgent: requestContext?.userAgent ?? null,
                legalHold: input.legalHold ?? false,
                previousHash: previousEntry?.entryHash ?? null,
                entryHash,
                metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined
              }
            });
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable
          }
        );
        return;
      } catch (error) {
        if (isSerializableConflict(error) && attempt < maxAttempts) {
          continue;
        }

        throw error;
      }
    }
  }
}
