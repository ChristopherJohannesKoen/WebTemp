import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsService } from '../src/modules/projects/projects.service';

const auditService = {
  log: vi.fn()
};

const configService = {
  get: vi.fn((key: string, defaultValue?: string) => {
    if (key === 'EXPORT_SYNC_LIMIT') {
      return '5000';
    }

    return defaultValue;
  })
};

const projectPolicyService = {
  assertCanMutateProject: vi.fn().mockResolvedValue(undefined)
};

const creator = {
  id: 'user_owner',
  email: 'owner@example.com',
  name: 'Owner User',
  role: 'owner'
} as const;

function createProjectRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'project_1',
    name: 'Starter project',
    description: 'Template-friendly project',
    status: 'active',
    isArchived: false,
    creatorId: creator.id,
    createdAt: new Date('2026-04-01T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    creator,
    ...overrides
  };
}

describe('ProjectsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists cursor-paginated projects', async () => {
    const prismaService = {
      project: {
        findMany: vi.fn().mockResolvedValue([createProjectRecord()])
      }
    };

    const service = new ProjectsService(
      prismaService as never,
      configService as never,
      auditService as never,
      projectPolicyService as never
    );
    const result = await service.listProjects({
      limit: 10,
      includeArchived: false
    });

    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.items[0]?.creator.email).toBe('owner@example.com');
  });

  it('streams projects as CSV', async () => {
    const prismaService = {
      project: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            createProjectRecord({
              description: 'Handles "quotes" and commas, too.'
            })
          ])
          .mockResolvedValueOnce([])
      }
    };

    const response = {
      write: vi.fn(),
      end: vi.fn()
    };

    const service = new ProjectsService(
      prismaService as never,
      configService as never,
      auditService as never,
      projectPolicyService as never
    );

    await service.exportProjects(response as never, {
      limit: 10,
      includeArchived: false
    });

    expect(response.write).toHaveBeenCalledWith(expect.stringContaining('"owner@example.com"'));
    expect(response.end).toHaveBeenCalledTimes(1);
  });

  it('logs archive actions when a project is archived', async () => {
    const prismaService = {
      project: {
        findUnique: vi.fn().mockResolvedValue(createProjectRecord()),
        update: vi.fn().mockResolvedValue(createProjectRecord({ isArchived: true }))
      }
    };

    const service = new ProjectsService(
      prismaService as never,
      configService as never,
      auditService as never,
      projectPolicyService as never
    );

    await service.updateProject(
      {
        id: 'user_owner',
        email: 'owner@example.com',
        name: 'Owner User',
        role: 'owner'
      },
      'project_1',
      {
        isArchived: true
      }
    );

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'project.archived',
        targetId: 'project_1'
      })
    );
  });

  it('rejects member writes to another member project', async () => {
    projectPolicyService.assertCanMutateProject.mockRejectedValueOnce(
      new ForbiddenException('You do not have permission to modify this project.')
    );

    const prismaService = {
      project: {
        findUnique: vi.fn().mockResolvedValue(
          createProjectRecord({
            creatorId: 'someone_else'
          })
        )
      }
    };

    const service = new ProjectsService(
      prismaService as never,
      configService as never,
      auditService as never,
      projectPolicyService as never
    );

    await expect(
      service.deleteProject(
        {
          id: 'user_member',
          email: 'member@example.com',
          name: 'Member User',
          role: 'member'
        },
        'project_1'
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
