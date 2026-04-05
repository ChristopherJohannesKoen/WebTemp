import { ForbiddenException, Injectable } from '@nestjs/common';
import type { SessionUser } from '@packages/shared';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ProjectPolicyService {
  constructor(private readonly auditService: AuditService) {}

  async assertCanMutateProject(
    actor: SessionUser,
    project: { id: string; creatorId: string },
    action: 'update' | 'archive' | 'delete'
  ) {
    if (actor.role === 'owner' || actor.role === 'admin' || project.creatorId === actor.id) {
      return;
    }

    await this.auditService.log({
      actorId: actor.id,
      action: 'authz.denied',
      targetType: 'project',
      targetId: project.id,
      metadata: {
        policy: 'project.write',
        attemptedAction: action,
        actorRole: actor.role,
        creatorId: project.creatorId
      }
    });

    throw new ForbiddenException('You do not have permission to modify this project.');
  }
}
