import 'reflect-metadata';
import {
  ForbiddenException,
  NotFoundException
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminService } from '../src/modules/admin/admin.service';

function createService(prismaOverrides: Record<string, unknown>) {
  const auditService = {
    log: vi.fn()
  };
  const metricsService = {
    recordOwnershipEvent: vi.fn()
  };

  const service = new AdminService(
    prismaOverrides as never,
    auditService as never,
    metricsService as never
  );

  return {
    service,
    auditService,
    metricsService
  };
}

describe('AdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows an owner to promote a user to owner', async () => {
    const transaction = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'user_owner',
            role: 'owner'
          })
          .mockResolvedValueOnce({
            id: 'user_member',
            email: 'member@example.com',
            name: 'Member User',
            role: 'member',
            createdAt: new Date('2026-04-01T00:00:00.000Z'),
            updatedAt: new Date('2026-04-01T00:00:00.000Z')
          }),
        count: vi.fn(),
        update: vi.fn().mockResolvedValue({
          id: 'user_member',
          email: 'member@example.com',
          name: 'Member User',
          role: 'owner',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-02T00:00:00.000Z')
        })
      }
    };

    const prismaService = {
      $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction))
    };

    const { service, auditService } = createService(prismaService);

    const result = await service.updateRole(
      {
        id: 'user_owner',
        email: 'owner@example.com',
        name: 'Owner User',
        role: 'owner'
      },
      'user_member',
      {
        role: 'owner'
      }
    );

    expect(result.role).toBe('owner');
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: 'user_member' },
      data: { role: 'owner' }
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.role_updated',
        targetId: 'user_member',
        metadata: { role: 'owner' }
      })
    );
  });

  it('rejects demoting the last owner and records a denied authorization event', async () => {
    const transaction = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'user_owner',
            role: 'owner'
          })
          .mockResolvedValueOnce({
            id: 'user_owner',
            email: 'owner@example.com',
            name: 'Owner User',
            role: 'owner',
            createdAt: new Date('2026-04-01T00:00:00.000Z'),
            updatedAt: new Date('2026-04-01T00:00:00.000Z')
          }),
        count: vi.fn().mockResolvedValue(1),
        update: vi.fn()
      }
    };

    const prismaService = {
      $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction))
    };

    const { service, auditService, metricsService } = createService(prismaService);

    await expect(
      service.updateRole(
        {
          id: 'user_owner',
          email: 'owner@example.com',
          name: 'Owner User',
          role: 'owner'
        },
        'user_owner',
        {
          role: 'member'
        }
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'owner_floor_violation'
      })
    });

    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(metricsService.recordOwnershipEvent).toHaveBeenCalledWith('owner_floor_violation');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'authz.denied',
        metadata: expect.objectContaining({
          reason: 'owner_floor_violation',
          role: 'member'
        })
      })
    );
  });

  it('rechecks actor role inside the transaction before applying owner-sensitive updates', async () => {
    const transaction = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user_owner',
          role: 'member'
        }),
        count: vi.fn(),
        update: vi.fn()
      }
    };

    const prismaService = {
      $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction))
    };

    const { service } = createService(prismaService);

    await expect(
      service.updateRole(
        {
          id: 'user_owner',
          email: 'owner@example.com',
          name: 'Owner User',
          role: 'owner'
        },
        'user_member',
        {
          role: 'admin'
        }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails with a deterministic role_conflict after repeated serialization conflicts', async () => {
    const prismaService = {
      $transaction: vi.fn().mockRejectedValue({
        code: 'P2034'
      })
    };

    const { service, auditService, metricsService } = createService(prismaService);

    await expect(
      service.updateRole(
        {
          id: 'user_owner',
          email: 'owner@example.com',
          name: 'Owner User',
          role: 'owner'
        },
        'user_member',
        {
          role: 'admin'
        }
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'role_conflict'
      })
    });

    expect(prismaService.$transaction).toHaveBeenCalledTimes(3);
    expect(metricsService.recordOwnershipEvent).toHaveBeenCalledWith('role_conflict');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'authz.denied',
        metadata: expect.objectContaining({
          reason: 'role_conflict'
        })
      })
    );
  });

  it('surfaces a not found error for unknown targets', async () => {
    const transaction = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'user_owner',
            role: 'owner'
          })
          .mockResolvedValueOnce(null),
        count: vi.fn(),
        update: vi.fn()
      }
    };

    const prismaService = {
      $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction))
    };

    const { service } = createService(prismaService);

    await expect(
      service.updateRole(
        {
          id: 'user_owner',
          email: 'owner@example.com',
          name: 'Owner User',
          role: 'owner'
        },
        'missing-user',
        {
          role: 'admin'
        }
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
