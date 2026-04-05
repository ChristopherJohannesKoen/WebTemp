import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { E2EFailpointController } from './e2e-failpoint.controller';
import { E2EFailpointMiddleware } from './e2e-failpoint.middleware';
import { E2EFailpointService } from './e2e-failpoint.service';

@Module({
  controllers: [E2EFailpointController],
  providers: [E2EFailpointService, E2EFailpointMiddleware]
})
export class E2EFailpointModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(E2EFailpointMiddleware)
      .exclude({ path: '__e2e/failpoints', method: RequestMethod.ALL })
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
