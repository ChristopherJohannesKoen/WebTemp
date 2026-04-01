import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prismaService: PrismaService) {}

  async log(input: {
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    await this.prismaService.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined
      }
    });
  }
}
