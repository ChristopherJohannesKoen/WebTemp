import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdempotencyService } from '../src/modules/idempotency/idempotency.service';

function createConfigService(overrides: Record<string, string> = {}) {
  return {
    get: vi.fn((key: string, defaultValue?: string) => overrides[key] ?? defaultValue)
  };
}

function createMetricsService() {
  return {
    recordOwnershipEvent: vi.fn(),
    recordIdempotencyEvent: vi.fn(),
    observeIdempotencyCleanup: vi.fn()
  };
}

function createUniqueConstraintError() {
  const error = new Error('unique violation');
  Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);
  return Object.assign(error, {
    code: 'P2002'
  });
}

describe('IdempotencyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not clean up expired requests during beginRequest', async () => {
    const prismaService = {
      idempotencyRequest: {
        create: vi.fn().mockResolvedValue({ id: 'record_1' }),
        deleteMany: vi.fn()
      }
    };
    const metricsService = createMetricsService();
    const service = new IdempotencyService(
      prismaService as never,
      createConfigService({
        IDEMPOTENCY_TTL_SECONDS: '60'
      }) as never,
      metricsService as never
    );

    const result = await service.beginRequest({
      scope: 'public',
      idempotencyKey: 'key_1',
      method: 'POST',
      path: '/api/projects',
      fingerprint: '{"body":{}}'
    });

    expect(result).toEqual({
      kind: 'new',
      recordId: 'record_1'
    });
    expect(prismaService.idempotencyRequest.deleteMany).not.toHaveBeenCalled();
    expect(metricsService.recordIdempotencyEvent).toHaveBeenCalledWith('new');
  });

  it('replays completed requests without emitting a new-request metric', async () => {
    const prismaService = {
      idempotencyRequest: {
        create: vi.fn().mockRejectedValue(createUniqueConstraintError()),
        findUnique: vi.fn().mockResolvedValue({
          id: 'record_1',
          fingerprint: '{"body":{}}',
          status: 'completed',
          responseStatusCode: 201,
          responseBody: { id: 'project_1' }
        })
      }
    };
    const metricsService = createMetricsService();
    const service = new IdempotencyService(
      prismaService as never,
      createConfigService() as never,
      metricsService as never
    );

    const result = await service.beginRequest({
      scope: 'public',
      idempotencyKey: 'key_1',
      method: 'POST',
      path: '/api/projects',
      fingerprint: '{"body":{}}'
    });

    expect(result).toEqual({
      kind: 'replay',
      statusCode: 201,
      body: { id: 'project_1' }
    });
    expect(metricsService.recordIdempotencyEvent).toHaveBeenCalledTimes(1);
    expect(metricsService.recordIdempotencyEvent).toHaveBeenCalledWith('replay');
  });

  it('rejects fingerprint mismatches for reused keys', async () => {
    const prismaService = {
      idempotencyRequest: {
        create: vi.fn().mockRejectedValue(createUniqueConstraintError()),
        findUnique: vi.fn().mockResolvedValue({
          id: 'record_1',
          fingerprint: '{"body":{"name":"other"}}',
          status: 'pending'
        })
      }
    };
    const metricsService = createMetricsService();
    const service = new IdempotencyService(
      prismaService as never,
      createConfigService() as never,
      metricsService as never
    );

    await expect(
      service.beginRequest({
        scope: 'public',
        idempotencyKey: 'key_1',
        method: 'POST',
        path: '/api/projects',
        fingerprint: '{"body":{"name":"current"}}'
      })
    ).rejects.toBeInstanceOf(ConflictException);
    expect(metricsService.recordIdempotencyEvent).toHaveBeenCalledWith(
      'fingerprint_mismatch'
    );
  });

  it('cleans up expired requests in bounded batches and records metrics', async () => {
    const prismaService = {
      idempotencyRequest: {
        findMany: vi.fn().mockResolvedValue([{ id: 'expired_1' }, { id: 'expired_2' }]),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        count: vi.fn().mockResolvedValue(5)
      }
    };
    const metricsService = createMetricsService();
    const service = new IdempotencyService(
      prismaService as never,
      createConfigService({
        IDEMPOTENCY_CLEANUP_BATCH_SIZE: '2'
      }) as never,
      metricsService as never
    );

    const result = await service.cleanupExpiredRequests('scheduled');

    expect(prismaService.idempotencyRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2
      })
    );
    expect(prismaService.idempotencyRequest.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['expired_1', 'expired_2']
        }
      }
    });
    expect(result.deletedCount).toBe(2);
    expect(result.remainingExpired).toBe(5);
    expect(metricsService.observeIdempotencyCleanup).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'scheduled',
        deletedCount: 2,
        remainingExpired: 5
      })
    );
  });
});
