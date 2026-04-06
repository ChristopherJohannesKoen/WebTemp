import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DataRetentionService } from './data-retention.service';

@Module({
  imports: [AuditModule],
  providers: [DataRetentionService]
})
export class GovernanceModule {}
