import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    recordSessionEvent: vi.fn()
  };
}

describe('SessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows only one concurrent rotation to write a new token hash', async () => {
    const sessionRecord = {
      id: 'session_1',
      tokenHash: 'existing-token-hash',
      csrfTokenHash: 'csrf-token-hash',
      userId: 'user_owner',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(Date.now() - 60_000),
      lastUsedAt: new Date(Date.now() - 900_000),
      lastRotatedAt: new Date(Date.now() - 3_600_000),
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      user: {
        id: 'user_owner',
        email: 'owner@example.com',
        name: 'Owner User',
        role: 'owner'
      }
    };

    const prismaService = {
      session: {
        findUnique: vi.fn().mockResolvedValue(sessionRecord),
        updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })
      }
    };

    const metricsService = createMetricsService();
    const service = new SessionService(
      prismaService as never,
      createConfigService({
        SESSION_ROTATION_MS: '1',
        SESSION_TOUCH_INTERVAL_MS: '1'
      }) as never,
      metricsService as never
    );

    const [firstResult, secondResult] = await Promise.all([
      service.resolveSessionContext('raw-token', {
        ipAddress: '10.0.0.1',
        userAgent: 'agent-a'
      }),
      service.resolveSessionContext('raw-token', {
        ipAddress: '10.0.0.2',
        userAgent: 'agent-b'
      })
    ]);

    expect(prismaService.session.updateMany).toHaveBeenCalledTimes(2);
    expect([firstResult?.rotatedToken, secondResult?.rotatedToken].filter(Boolean)).toHaveLength(1);
    expect(metricsService.recordSessionEvent).toHaveBeenCalledWith('touched');
    expect(metricsService.recordSessionEvent).toHaveBeenCalledWith('rotated');
  });

  it('round-trips encrypted session cookie values', () => {
    const service = new SessionService(
      {} as never,
      createConfigService() as never,
      createMetricsService() as never
    );

    const rawToken = 'raw-session-token';
    const encodedToken = service.encodeSessionCookieToken(rawToken);

    expect(encodedToken).not.toBe(rawToken);
    expect(service.decodeSessionCookieToken(encodedToken)).toBe(rawToken);
    expect(service.decodeSessionCookieToken(`${encodedToken}tampered`)).toBeUndefined();
  });
});
