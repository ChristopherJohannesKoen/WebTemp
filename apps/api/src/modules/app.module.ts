import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment } from '../common/config/environment.validation';
import { CsrfMiddleware } from '../common/middleware/csrf.middleware';
import { OriginGuardMiddleware } from '../common/middleware/origin-guard.middleware';
import { RequestContextMiddleware } from '../common/middleware/request-context.middleware';
import { SessionMiddleware } from '../common/middleware/session.middleware';
import { AdminModule } from './admin/admin.module';
import { AdminController } from './admin/admin.controller';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AuthController } from './auth/auth.controller';
import { HealthModule } from './health/health.module';
import { HealthController } from './health/health.controller';
import { ObservabilityModule } from './observability/observability.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { ProjectsController } from './projects/projects.controller';
import { UsersModule } from './users/users.module';
import { UsersController } from './users/users.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_WINDOW_MS ?? '60000'),
        limit: Number(process.env.RATE_LIMIT_MAX ?? '120')
      }
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    ObservabilityModule,
    AuditModule,
    AuthModule,
    UsersModule,
    AdminModule,
    ProjectsModule,
    HealthModule
  ],
  providers: [
    RequestContextMiddleware,
    SessionMiddleware,
    OriginGuardMiddleware,
    CsrfMiddleware,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware, SessionMiddleware, OriginGuardMiddleware, CsrfMiddleware)
      .forRoutes(AuthController, UsersController, AdminController, ProjectsController, HealthController);
  }
}
