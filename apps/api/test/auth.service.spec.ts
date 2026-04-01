import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/modules/auth/auth.service';

function createConfigService(overrides: Record<string, string> = {}) {
  return {
    get: vi.fn((key: string, defaultValue?: string) => overrides[key] ?? defaultValue)
  };
}

describe('AuthService', () => {
  const auditService = {
    log: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the first account as owner and opens a session', async () => {
    const prismaService = {
      user: {
        findUnique: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({
          id: 'user_owner',
          email: 'owner@example.com',
          name: 'Owner User',
          role: 'owner',
          passwordHash: 'hashed'
        })
      },
      session: {
        create: vi.fn().mockResolvedValue(undefined)
      }
    };

    const service = new AuthService(
      prismaService as never,
      createConfigService({
        ARGON2_MEMORY_COST: '1024',
        SESSION_COOKIE_NAME: 'test_session'
      }) as never,
      auditService as never
    );

    const result = await service.signUp(
      {
        name: 'Owner User',
        email: 'owner@example.com',
        password: 'password123'
      },
      {
        ipAddress: '127.0.0.1',
        userAgent: 'vitest'
      }
    );

    expect(result.user.role).toBe('owner');
    expect(result.token).toHaveLength(64);
    expect(prismaService.session.create).toHaveBeenCalledTimes(1);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.signup',
        metadata: { role: 'owner' }
      })
    );
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

    const service = new AuthService(
      prismaService as never,
      createConfigService({
        ARGON2_MEMORY_COST: '1024'
      }) as never,
      auditService as never
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

  it('returns a development reset link when the user exists', async () => {
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

    const service = new AuthService(
      prismaService as never,
      createConfigService({
        NODE_ENV: 'development',
        APP_URL: 'http://localhost:3000',
        ARGON2_MEMORY_COST: '1024'
      }) as never,
      auditService as never
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

    const service = new AuthService(
      prismaService as never,
      createConfigService({
        ARGON2_MEMORY_COST: '1024'
      }) as never,
      auditService as never
    );

    const currentUser = await service.getSessionUserFromToken('raw-token');

    expect(currentUser).toBeUndefined();
    expect(prismaService.session.delete).toHaveBeenCalledWith({
      where: { id: 'session_1' }
    });
  });
});
