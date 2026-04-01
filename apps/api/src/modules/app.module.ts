import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { OriginGuardMiddleware } from '../common/middleware/origin-guard.middleware';
import { RequestContextMiddleware } from '../common/middleware/request-context.middleware';
import { SessionMiddleware } from '../common/middleware/session.middleware';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
        APP_URL: Joi.string().uri().required(),
        API_ORIGIN: Joi.string().uri().required(),
        API_PORT: Joi.number().default(4000),
        API_PREFIX: Joi.string().default('api'),
        DATABASE_URL: Joi.string().required(),
        SESSION_SECRET: Joi.string().min(16).required(),
        SESSION_COOKIE_NAME: Joi.string().default('ultimate_template_session'),
        ARGON2_MEMORY_COST: Joi.number().default(19456),
        RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
        RATE_LIMIT_MAX: Joi.number().default(120),
        SEED_OWNER_EMAIL: Joi.string().email().required(),
        SEED_OWNER_PASSWORD: Joi.string().min(8).required(),
        SMTP_HOST: Joi.string().allow('').optional(),
        SMTP_PORT: Joi.number().allow('', null).optional(),
        SMTP_USER: Joi.string().allow('').optional(),
        SMTP_PASSWORD: Joi.string().allow('').optional(),
        REDIS_URL: Joi.string().allow('').optional(),
        S3_BUCKET: Joi.string().allow('').optional(),
        S3_REGION: Joi.string().allow('').optional(),
        S3_ACCESS_KEY_ID: Joi.string().allow('').optional(),
        S3_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
        OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().allow('').optional()
      })
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_WINDOW_MS ?? '60000'),
        limit: Number(process.env.RATE_LIMIT_MAX ?? '120')
      }
    ]),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    AdminModule,
    ProjectsModule,
    HealthModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware, SessionMiddleware, OriginGuardMiddleware)
      .forRoutes('*');
  }
}
