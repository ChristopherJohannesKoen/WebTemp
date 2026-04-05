import { Global, Module } from '@nestjs/common';
import { RequestContextService } from '../request-context/request-context.service';
import { SecretService } from '../secrets/secret.service';

@Global()
@Module({
  providers: [RequestContextService, SecretService],
  exports: [RequestContextService, SecretService]
})
export class CommonInfrastructureModule {}
