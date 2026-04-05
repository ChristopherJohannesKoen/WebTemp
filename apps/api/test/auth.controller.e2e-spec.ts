import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { IdempotencyInterceptor } from '../src/modules/idempotency/idempotency.interceptor';
import { IdempotencyService } from '../src/modules/idempotency/idempotency.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  const authService = {
    login: vi.fn().mockResolvedValue({
      user: {
        id: 'user_owner',
        email: 'owner@example.com',
        name: 'Owner User',
        role: 'owner'
      },
      token: 'session-token',
      expiresAt: new Date('2026-04-15T00:00:00.000Z')
    }),
    getCookieName: vi.fn().mockReturnValue('template_session'),
    getCookieOptions: vi.fn().mockReturnValue({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: new Date('2026-04-15T00:00:00.000Z')
    })
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService
        },
        {
          provide: IdempotencyInterceptor,
          useValue: {
            intercept: (_: unknown, next: { handle: () => unknown }) => next.handle()
          }
        },
        {
          provide: IdempotencyService,
          useValue: {
            beginRequest: vi.fn(),
            completeRequest: vi.fn(),
            abandonRequest: vi.fn(),
            createFingerprint: vi.fn()
          }
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    vi.clearAllMocks();
  });

  it('sets the session cookie on login', async () => {
    const response = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'owner@example.com',
      password: 'password123'
    });

    const setCookieHeader = response.headers['set-cookie'];

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe('owner@example.com');
    expect(setCookieHeader).toBeDefined();
    expect(setCookieHeader?.[0]).toContain('template_session=session-token');
    expect(setCookieHeader?.[0]).toContain('Path=/');
    expect(setCookieHeader?.[0]).toContain('HttpOnly');
    expect(setCookieHeader?.[0]).toContain('SameSite=Lax');
  });
});
