import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { ProjectsController } from './projects.controller';
import { ProjectPolicyService } from './project-policy.service';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AuditModule, IdempotencyModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectPolicyService]
})
export class ProjectsModule {}
