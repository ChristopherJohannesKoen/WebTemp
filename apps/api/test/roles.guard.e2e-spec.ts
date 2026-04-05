import 'reflect-metadata';
import {
  Controller,
  Get,
  INestApplication,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
  UseGuards
} from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Roles } from '../src/common/decorators/roles.decorator';
import { RolesGuard } from '../src/common/guards/roles.guard';
import type { AuthenticatedRequest } from '../src/common/types/authenticated-request';

@Injectable()
class FakeCurrentUserMiddleware implements NestMiddleware {
  use(request: AuthenticatedRequest, _: Response, next: NextFunction) {
    const role = request.header('x-role');

    if (role) {
      request.currentUser = {
        id: 'user_1',
        email: 'user@example.com',
        name: 'Role Test User',
        role: role as 'owner' | 'admin' | 'member'
      };
    }

    next();
  }
}

@Controller()
@UseGuards(RolesGuard)
class RolesGuardTestController {
  @Get('owner-only')
  @Roles('owner')
  ownerOnly() {
    return { ok: true };
  }
}

@Module({
  controllers: [RolesGuardTestController],
  providers: [RolesGuard]
})
class RolesGuardTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    const middleware = new FakeCurrentUserMiddleware();

    consumer.apply(middleware.use.bind(middleware)).forRoutes(RolesGuardTestController);
  }
}

describe('RolesGuard (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RolesGuardTestModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('returns 401 when the request is unauthenticated', async () => {
    const response = await request(app.getHttpServer()).get('/owner-only');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Authentication required.');
  });

  it('returns 403 when the authenticated user lacks the required role', async () => {
    const response = await request(app.getHttpServer()).get('/owner-only').set('x-role', 'member');

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('You do not have access to this resource.');
  });

  it('allows the request when the authenticated user has the required role', async () => {
    const response = await request(app.getHttpServer()).get('/owner-only').set('x-role', 'owner');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
