import 'reflect-metadata';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/modules/auth/auth.service';
import { SessionService } from '../src/modules/auth/session.service';

function createConfigService(overrides: Record<string, string> = {}) {
  return {
    get: vi.fn(
      (key: string, defaultValue?: string) =>
        overrides[key] ??
        (key === 'SESSION_COOKIE_ENCRYPTION_KEY'
          ? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
          : defaultValue)
    )
  };
}

function createMetricsService() {
  return {
    observeHttpRequest: vi.fn(),
    recordAuthEvent: vi.fn(),
    recordSessionEvent: vi.fn(),
    recordSecurityEvent: vi.fn(),
    recordOwnershipEvent: vi.fn(),
    recordIdentityEvent: vi.fn(),
    recordIdempotencyEvent: vi.fn(),
    observeIdempotencyCleanup: vi.fn()
  };
}

function createSecretService() {
  return {
    getRequiredSecret: vi.fn((key: string) =>
      key === 'SESSION_COOKIE_ENCRYPTION_KEY'
        ? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        : ''
    ),
    getOptionalSecret: vi.fn()
  };
}

function withSessionTransaction(prismaService: Record<string, unknown>) {
  return {
    ...prismaService,
    $transaction: vi.fn(async (callback: (transaction: Record<string, unknown>) => unknown) =>
      callback(prismaService)
    )
  };
}

function createAuthService(
  prismaService: Record<string, unknown>,
  configOverrides: Record<string, string> = {},
  auditService: { log: ReturnType<typeof vi.fn> }
) {
  const configService = createConfigService(configOverrides);
  const metricsService = createMetricsService();
  const sessionService = new SessionService(
    prismaService as never,
    configService as never,
    metricsService as never,
    createSecretService() as never
  );

  return {
    configService,
    metricsService,
    sessionService,
    authService: new AuthService(
      prismaService as never,
      configService as never,
      auditService as never,
      sessionService,
      metricsService as never
    )
  };
}

describe('AuthService', () => {
  const auditService = {
    log: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates public signup accounts as members and opens a capped session', async () => {
    const prismaService = {
      user: {
        create: vi.fn().mockResolvedValue({
          id: 'user_member',
          email: 'member@example.com',
          name: 'Member User',
          role: 'member'
        })
      },
      session: {
        create: vi.fn().mockResolvedValue(undefined),
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 })
      }
    };

    const { authService: service } = createAuthService(
      withSessionTransaction(prismaService),
      {
        ARGON2_MEMORY_COST: '1024',
        SESSION_MAX_ACTIVE: '5',
        SESSION_COOKIE_NAME: 'test_session'
      },
      auditService
    );

    const result = await service.signUp(
      {
        name: 'Member User',
        email: 'member@example.com',
        password: 'password123'
      },
      {
        ipAddress: '127.0.0.1',
        userAgent: 'vitest'
      }
    );

    expect(result.user.role).toBe('member');
    expect(result.token).toHaveLength(64);
    expect(prismaService.session.create).toHaveBeenCalledTimes(1);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.signup',
        metadata: { role: 'member' }
      })
    );
  });

  it('keeps concurrent public signups as members', async () => {
    const prismaService = {
      user: {
        create: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'user_member_1',
            email: 'member1@example.com',
            name: 'Member One',
            role: 'member'
          })
          .mockResolvedValueOnce({
            id: 'user_member_2',
            email: 'member2@example.com',
            name: 'Member Two',
            role: 'member'
          })
      },
      session: {
        create: vi.fn().mockResolvedValue(undefined),
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 })
      }
    };

    const { authService: service } = createAuthService(
      withSessionTransaction(prismaService),
      {
        ARGON2_MEMORY_COST: '1024',
        SESSION_MAX_ACTIVE: '5'
      },
      auditService
    );

    const [firstSignup, secondSignup] = await Promise.all([
      service.signUp(
        {
          name: 'Member One',
          email: 'member1@example.com',
          password: 'password123'
        },
        {}
      ),
      service.signUp(
        {
          name: 'Member Two',
          email: 'member2@example.com',
          password: 'password123'
        },
        {}
      )
    ]);

    expect(firstSignup.user.role).toBe('member');
    expect(secondSignup.user.role).toBe('member');
    expect(prismaService.user.create).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid login credentials', async () => {
    const passwordHash = await argon2.hash('correct-password', {
      type: argon2.argon2id,
      memoryCost: 1024
    });

    const prismaService = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user_member',
          email: 'member@example.com',
          name: 'Member User',
          role: 'member',
          passwordHash
        })
      }
    };

    const { authService: service } = createAuthService(
      prismaService,
      {
        ARGON2_MEMORY_COST: '1024'
      },
      auditService
    );

    await expect(
      service.login(
        {
          email: 'member@example.com',
          password: 'wrong-password'
        },
        {}
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects local login when enterprise identity is enforced', async () => {
    const { authService: service } = createAuthService(
      {
        user: {
          findUnique: vi.fn()
        }
      },
      {
        NODE_ENV: 'production',
        APP_ENV: 'production',
        ENTERPRISE_IDENTITY_ENABLED: 'true'
      },
      auditService
    );

    await expect(
      service.login(
        {
          email: 'member@example.com',
          password: 'password123'
        },
        {}
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows audited break-glass login for an owner when explicitly enabled', async () => {
    const passwordHash = await argon2.hash('ChangeMe123!', {
      type: argon2.argon2id,
      memoryCost: 1024
    });
    const prismaService = withSessionTransaction({
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user_owner',
          email: 'owner@example.com',
          name: 'Owner User',
          role: 'owner',
          disabledAt: null,
          passwordHash
        })
      },
      session: {
        create: vi.fn().mockResolvedValue(undefined),
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 })
      }
    });

    const { authService: service, metricsService } = createAuthService(
      prismaService,
      {
        NODE_ENV: 'production',
        APP_ENV: 'production',
        ENTERPRISE_IDENTITY_ENABLED: 'true',
        BREAK_GLASS_LOCAL_LOGIN_ENABLED: 'true'
      },
      auditService
    );

    const result = await service.breakGlassLogin(
      {
        email: 'owner@example.com',
        password: 'ChangeMe123!'
      },
      {}
    );

    expect(result.user.role).toBe('owner');
    expect(metricsService.recordAuthEvent).toHaveBeenCalledWith('break_glass_login');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.break_glass_login',
        authMechanism: 'break_glass'
      })
    );
  });

  it('records a privileged step-up window for owners', async () => {
    const passwordHash = await argon2.hash('ChangeMe123!', {
      type: argon2.argon2id,
      memoryCost: 1024
    });
    const prismaService = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user_owner',
          email: 'owner@example.com',
          name: 'Owner User',
          role: 'owner',
          passwordHash
        })
      }
    };

    const {
      authService: service,
      sessionService,
      metricsService
    } = createAuthService(
      prismaService,
      {
        OWNER_STEP_UP_WINDOW_MS: '600000'
      },
      auditService
    );
    const markStepUpCompleted = vi
      .spyOn(sessionService, 'markStepUpCompleted')
      .mockResolvedValue(undefined);

    const result = await service.completeStepUp(
      {
        id: 'user_owner',
        email: 'owner@example.com',
        name: 'Owner User',
        role: 'owner'
      },
      {
        id: 'session_owner',
        userId: 'user_owner',
        csrfTokenHash: 'csrf',
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
      },
      'ChangeMe123!'
    );

    expect(result.ok).toBe(true);
    expect(markStepUpCompleted).toHaveBeenCalledWith('session_owner', expect.any(Date));
    expect(metricsService.recordAuthEvent).toHaveBeenCalledWith('step_up_completed');
  });

  it('returns a reset link only when explicitly enabled for non-production environments', async () => {
    const prismaService = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user_member',
          email: 'member@example.com'
        })
      },
      passwordResetToken: {
        create: vi.fn().mockResolvedValue(undefined)
      }
    };

    const { authService: service } = createAuthService(
      prismaService,
      {
        NODE_ENV: 'development',
        APP_ENV: 'local',
        APP_URL: 'http://localhost:3000',
        EXPOSE_DEV_RESET_DETAILS: 'true',
        ARGON2_MEMORY_COST: '1024'
      },
      auditService
    );

    const result = await service.requestPasswordReset({
      email: 'member@example.com'
    });

    expect(result.resetToken).toBeTruthy();
    expect(result.resetUrl).toContain('/reset-password?token=');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.password_reset_requested'
      })
    );
  });

  it('hides reset details when non-production exposure is not explicitly enabled', async () => {
    const prismaService = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user_member',
          email: 'member@example.com'
        })
      },
      passwordResetToken: {
        create: vi.fn().mockResolvedValue(undefined)
      }
    };

    const { authService: service } = createAuthService(
      prismaService,
      {
        NODE_ENV: 'development',
        APP_ENV: 'local',
        APP_URL: 'http://localhost:3000',
        EXPOSE_DEV_RESET_DETAILS: 'false',
        ARGON2_MEMORY_COST: '1024'
      },
      auditService
    );

    const result = await service.requestPasswordReset({
      email: 'member@example.com'
    });

    expect(result.resetToken).toBeUndefined();
    expect(result.resetUrl).toBeUndefined();
  });

  it('invalidates expired sessions when resolving the current user', async () => {
    const prismaService = {
      session: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'session_1',
          expiresAt: new Date(Date.now() - 1_000),
          user: {
            id: 'user_member',
            email: 'member@example.com',
            name: 'Member User',
            role: 'member'
          }
        }),
        delete: vi.fn().mockResolvedValue(undefined)
      }
    };

    const { authService: service } = createAuthService(
      prismaService,
      {
        ARGON2_MEMORY_COST: '1024'
      },
      auditService
    );

    const currentUser = await service.getSessionUserFromToken('raw-token');

    expect(currentUser).toBeUndefined();
    expect(prismaService.session.delete).toHaveBeenCalledWith({
      where: { id: 'session_1' }
    });
  });

  it('requires a matching CSRF token for authenticated mutations', () => {
    const { authService: service } = createAuthService(
      {},
      {
        ARGON2_MEMORY_COST: '1024'
      },
      auditService
    );

    expect(() =>
      service.assertCsrfToken(
        {
          id: 'session_1',
          userId: 'user_member',
          csrfTokenHash: 'invalid',
          authMethod: 'local',
          authReason: 'local_login',
          identityProviderId: null,
          externalSubject: null,
          stepUpAt: null,
          expiresAt: new Date(),
          createdAt: new Date(),
          lastUsedAt: new Date(),
          lastRotatedAt: new Date(),
          ipAddress: null,
          userAgent: null
        },
        'raw-token'
      )
    ).toThrow(ForbiddenException);
  });

  it('does not rewrite active sessions inside the touch window', async () => {
    const prismaService = {
      session: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'session_1',
          tokenHash: 'existing-hash',
          csrfTokenHash: 'csrf-hash',
          userId: 'user_member',
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(Date.now() - 60_000),
          lastUsedAt: new Date(Date.now() - 30_000),
          lastRotatedAt: new Date(Date.now() - 30_000),
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
          user: {
            id: 'user_member',
            email: 'member@example.com',
            name: 'Member User',
            role: 'member'
          }
        }),
        update: vi.fn()
      }
    };

    const { authService: service } = createAuthService(
      prismaService,
      {
        ARGON2_MEMORY_COST: '1024',
        SESSION_ROTATION_MS: '3600000',
        SESSION_TOUCH_INTERVAL_MS: '600000'
      },
      auditService
    );

    const sessionContext = await service.getSessionContextFromToken('raw-token', {
      ipAddress: '127.0.0.1',
      userAgent: 'vitest'
    });

    expect(sessionContext?.user.email).toBe('member@example.com');
    expect(prismaService.session.update).not.toHaveBeenCalled();
  });

  it('touches and rotates sessions when the policy requires it', async () => {
    const prismaService = {
      session: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'session_1',
          tokenHash: 'existing-hash',
          csrfTokenHash: 'csrf-hash',
          userId: 'user_member',
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(Date.now() - 7_200_000),
          lastUsedAt: new Date(Date.now() - 900_000),
          lastRotatedAt: new Date(Date.now() - 7_200_000),
          ipAddress: '127.0.0.1',
          userAgent: 'old-agent',
          user: {
            id: 'user_member',
            email: 'member@example.com',
            name: 'Member User',
            role: 'member'
          }
        }),
        updateMany: vi.fn().mockResolvedValue({
          count: 1
        })
      }
    };

    const { authService: service } = createAuthService(
      prismaService,
      {
        ARGON2_MEMORY_COST: '1024',
        SESSION_ROTATION_MS: '1000',
        SESSION_TOUCH_INTERVAL_MS: '600000'
      },
      auditService
    );

    const sessionContext = await service.getSessionContextFromToken('raw-token', {
      ipAddress: '10.0.0.1',
      userAgent: 'new-agent'
    });

    expect(prismaService.session.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaService.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastUsedAt: expect.any(Date),
          lastRotatedAt: expect.any(Date),
          tokenHash: expect.any(String),
          ipAddress: '10.0.0.1',
          userAgent: 'new-agent'
        })
      })
    );
    expect(sessionContext?.rotatedToken).toHaveLength(64);
  });
});
