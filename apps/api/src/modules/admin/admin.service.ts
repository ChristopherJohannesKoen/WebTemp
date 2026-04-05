import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SessionUser } from '@packages/shared';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ListUsersDto } from './dto/list-users.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import type { AuthenticatedSession } from '../../common/types/authenticated-request';

const OWNER_FLOOR_CODE = 'owner_floor_violation';
const ROLE_CONFLICT_CODE = 'role_conflict';
const OWNER_FLOOR_MESSAGE = 'At least one owner must remain assigned.';
const ROLE_CONFLICT_MESSAGE =
  'Could not complete the owner-sensitive role update because a concurrent change was detected.';
const STEP_UP_REQUIRED_CODE = 'step_up_required';
const STEP_UP_REQUIRED_MESSAGE = 'A recent owner confirmation is required before changing roles.';

function isSerializableConflict(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'P2034'
  );
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
    private readonly metricsService: MetricsService
  ) {}

  async listUsers(query: ListUsersDto) {
    const [total, items] = await this.prismaService.$transaction([
      this.prismaService.user.count(),
      this.prismaService.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      })
    ]);

    return {
      items: items.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      })),
      page: query.page,
      pageSize: query.pageSize,
      total
    };
  }

  async updateRole(
    actor: SessionUser,
    actorSession: AuthenticatedSession,
    targetId: string,
    dto: UpdateRoleDto
  ) {
    if (actor.role !== 'owner') {
      throw new ForbiddenException('Only the owner can change roles.');
    }

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const updatedUser = await this.prismaService.$transaction(
          async (transaction) => {
            const freshActor = await transaction.user.findUnique({
              where: { id: actor.id },
              select: {
                id: true,
                role: true
              }
            });

            if (!freshActor || freshActor.role !== 'owner') {
              throw new ForbiddenException('Only the owner can change roles.');
            }

            const target = await transaction.user.findUnique({
              where: { id: targetId }
            });

            if (!target) {
              throw new NotFoundException('User not found.');
            }

            if (this.isOwnerSensitiveRoleChange(target.role, dto.role)) {
              this.assertOwnerStepUp(actorSession);
            }

            if (target.id === actor.id && dto.role !== 'owner') {
              const ownerCount = await transaction.user.count({
                where: { role: 'owner' }
              });

              if (ownerCount <= 1) {
                throw new ConflictException({
                  message: OWNER_FLOOR_MESSAGE,
                  code: OWNER_FLOOR_CODE
                });
              }
            }

            if (target.role === 'owner' && dto.role !== 'owner') {
              const ownerCount = await transaction.user.count({
                where: { role: 'owner' }
              });

              if (ownerCount <= 1) {
                throw new ConflictException({
                  message: OWNER_FLOOR_MESSAGE,
                  code: OWNER_FLOOR_CODE
                });
              }
            }

            if (target.role === dto.role) {
              return target;
            }

            return transaction.user.update({
              where: { id: targetId },
              data: { role: dto.role }
            });
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable
          }
        );

        await this.auditService.log({
          actorId: actor.id,
          action: 'user.role_updated',
          targetType: 'user',
          targetId: updatedUser.id,
          metadata: { role: dto.role }
        });

        return {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          createdAt: updatedUser.createdAt.toISOString(),
          updatedAt: updatedUser.updatedAt.toISOString()
        };
      } catch (error) {
        if (error instanceof BadRequestException || error instanceof NotFoundException) {
          throw error;
        }

        if (error instanceof ForbiddenException) {
          await this.auditService.log({
            actorId: actor.id,
            action: 'authz.denied',
            targetType: 'user',
            targetId,
            metadata: {
              reason: 'owner_role_required',
              role: dto.role
            }
          });
          throw error;
        }

        if (error instanceof ConflictException) {
          const response = error.getResponse();
          const code =
            typeof response === 'object' && response && 'code' in response
              ? String((response as { code?: string }).code)
              : undefined;

          if (code === OWNER_FLOOR_CODE) {
            this.metricsService.recordOwnershipEvent(OWNER_FLOOR_CODE);
            await this.auditService.log({
              actorId: actor.id,
              action: 'authz.denied',
              targetType: 'user',
              targetId,
              metadata: {
                reason: OWNER_FLOOR_CODE,
                role: dto.role
              }
            });
          }

          throw error;
        }

        if (isSerializableConflict(error)) {
          if (attempt < maxAttempts) {
            continue;
          }

          this.metricsService.recordOwnershipEvent(ROLE_CONFLICT_CODE);
          await this.auditService.log({
            actorId: actor.id,
            action: 'authz.denied',
            targetType: 'user',
            targetId,
            metadata: {
              reason: ROLE_CONFLICT_CODE,
              role: dto.role
            }
          });
          throw new ConflictException({
            message: ROLE_CONFLICT_MESSAGE,
            code: ROLE_CONFLICT_CODE
          });
        }

        throw error;
      }
    }

    throw new ConflictException({
      message: ROLE_CONFLICT_MESSAGE,
      code: ROLE_CONFLICT_CODE
    });
  }

  private assertOwnerStepUp(session: AuthenticatedSession) {
    if (session.stepUpAt && session.stepUpAt.getTime() > Date.now()) {
      return;
    }

    throw new ForbiddenException({
      message: STEP_UP_REQUIRED_MESSAGE,
      code: STEP_UP_REQUIRED_CODE
    });
  }

  private isOwnerSensitiveRoleChange(
    currentRole: SessionUser['role'],
    nextRole: SessionUser['role']
  ) {
    return currentRole === 'owner' || nextRole === 'owner';
  }
}
