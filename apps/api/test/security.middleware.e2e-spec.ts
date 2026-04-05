import 'reflect-metadata';
import {
  Controller,
  INestApplication,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
  Post
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { CsrfMiddleware } from '../src/common/middleware/csrf.middleware';
import { OriginGuardMiddleware } from '../src/common/middleware/origin-guard.middleware';
import type { AuthenticatedRequest } from '../src/common/types/authenticated-request';

const csrfToken = 'expected-csrf-token';

@Injectable()
class FakeSessionMiddleware implements NestMiddleware {
  use(request: AuthenticatedRequest, _: Response, next: NextFunction) {
    if (request.header('x-authenticated') === 'true') {
      request.currentUser = {
        id: 'user_member',
        email: 'member@example.com',
        name: 'Member User',
        role: 'member'
      };
      request.currentSession = {
        id: 'session_1',
        userId: 'user_member',
        csrfTokenHash: createHash('sha256').update(csrfToken).digest('hex'),
        authMethod: 'local',
        authReason: 'local_login',
        identityProviderId: null,
        externalSubject: null,
        stepUpAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        lastUsedAt: new Date(),
        lastRotatedAt: new Date(),
        ipAddress: null,
        userAgent: null
      };
    }

    next();
  }
}

@Controller()
class SecurityMiddlewareTestController {
  @Post('mutate')
  mutate() {
    return { ok: true };
  }
}

@Module({
  controllers: [SecurityMiddlewareTestController]
})
class SecurityMiddlewareTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    const fakeSessionMiddleware = new FakeSessionMiddleware();
    const metricsService = {
      recordSecurityEvent: () => undefined
    } as never;
    const originGuardMiddleware = new OriginGuardMiddleware(metricsService);
    const csrfMiddleware = new CsrfMiddleware(metricsService);

    consumer
      .apply(
        fakeSessionMiddleware.use.bind(fakeSessionMiddleware),
        originGuardMiddleware.use.bind(originGuardMiddleware),
        csrfMiddleware.use.bind(csrfMiddleware)
      )
      .forRoutes(SecurityMiddlewareTestController);
  }
}

describe('Security middleware (e2e)', () => {
  let app: INestApplication;

  function setEnv(overrides: Record<string, string>) {
    process.env.NODE_ENV = overrides.NODE_ENV;
    process.env.APP_ENV = overrides.APP_ENV;
    process.env.APP_URL = overrides.APP_URL;
    process.env.API_ORIGIN = overrides.API_ORIGIN;
    process.env.ALLOWED_ORIGINS = overrides.ALLOWED_ORIGINS ?? '';
    process.env.ALLOW_MISSING_ORIGIN_FOR_DEV = overrides.ALLOW_MISSING_ORIGIN_FOR_DEV ?? 'false';
  }

  async function createApp() {
    const moduleRef = await Test.createTestingModule({
      imports: [SecurityMiddlewareTestModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  }

  afterEach(async () => {
    await app?.close();
  });

  it('allows missing origin in test mode', async () => {
    setEnv({
      NODE_ENV: 'test',
      APP_ENV: 'test',
      APP_URL: 'http://localhost:3000',
      API_ORIGIN: 'http://localhost:4000'
    });
    await createApp();

    const response = await request(app.getHttpServer()).post('/mutate');

    expect(response.status).toBe(201);
  });

  it('rejects missing origin by default in development', async () => {
    setEnv({
      NODE_ENV: 'development',
      APP_ENV: 'local',
      APP_URL: 'http://localhost:3000',
      API_ORIGIN: 'http://localhost:4000',
      ALLOW_MISSING_ORIGIN_FOR_DEV: 'false'
    });
    await createApp();

    const response = await request(app.getHttpServer()).post('/mutate');

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Missing request origin.');
  });

  it('allows missing origin only when explicitly enabled for local development', async () => {
    setEnv({
      NODE_ENV: 'development',
      APP_ENV: 'local',
      APP_URL: 'http://localhost:3000',
      API_ORIGIN: 'http://localhost:4000',
      ALLOW_MISSING_ORIGIN_FOR_DEV: 'true'
    });
    await createApp();

    const response = await request(app.getHttpServer()).post('/mutate');

    expect(response.status).toBe(201);
  });

  it('rejects missing origin in staging and production app environments', async () => {
    setEnv({
      NODE_ENV: 'production',
      APP_ENV: 'staging',
      APP_URL: 'https://app.example.com',
      API_ORIGIN: 'https://api.example.com'
    });
    await createApp();

    const response = await request(app.getHttpServer()).post('/mutate');

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Missing request origin.');
  });

  it('rejects missing origin in production', async () => {
    setEnv({
      NODE_ENV: 'production',
      APP_ENV: 'production',
      APP_URL: 'https://app.example.com',
      API_ORIGIN: 'https://api.example.com'
    });
    await createApp();

    const response = await request(app.getHttpServer()).post('/mutate');

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Missing request origin.');
  });

  it('requires a valid csrf token for authenticated unsafe requests', async () => {
    setEnv({
      NODE_ENV: 'test',
      APP_ENV: 'test',
      APP_URL: 'http://localhost:3000',
      API_ORIGIN: 'http://localhost:4000'
    });
    await createApp();

    const missingTokenResponse = await request(app.getHttpServer())
      .post('/mutate')
      .set('x-authenticated', 'true');
    expect(missingTokenResponse.status).toBe(403);
    expect(missingTokenResponse.body.message).toBe('A valid CSRF token is required.');

    const invalidTokenResponse = await request(app.getHttpServer())
      .post('/mutate')
      .set('x-authenticated', 'true')
      .set('x-csrf-token', 'invalid-token');
    expect(invalidTokenResponse.status).toBe(403);
    expect(invalidTokenResponse.body.message).toBe('A valid CSRF token is required.');

    const validTokenResponse = await request(app.getHttpServer())
      .post('/mutate')
      .set('x-authenticated', 'true')
      .set('x-csrf-token', csrfToken);
    expect(validTokenResponse.status).toBe(201);
    expect(validTokenResponse.body).toEqual({ ok: true });
  });
});
