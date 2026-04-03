import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
    expect(prismaService.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          creator: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              email: true,
              name: true,
              role: true
            })
          })
        })
      })
    );
  });

  it('streams the full filtered CSV result under the synchronous limit', async () => {
    const prismaService = {
      project: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            createProjectRecord({
              description: 'Handles "quotes" and commas, too.'
            }),
            createProjectRecord({
              id: 'project_2',
              name: 'Second project',
              description: 'Additional exported row.'
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
    expect(response.write).toHaveBeenCalledWith(expect.stringContaining('"Second project"'));
    expect(response.end).toHaveBeenCalledTimes(1);
  });

  it('returns a structured export_limit_exceeded error when the filtered export is too large', async () => {
    const limitedConfigService = {
      get: vi.fn((key: string, defaultValue?: string) => {
        if (key === 'EXPORT_SYNC_LIMIT') {
          return '1';
        }

        return defaultValue;
      })
    };

    const prismaService = {
      project: {
        count: vi.fn().mockResolvedValue(2)
      }
    };

    const response = {
      write: vi.fn(),
      end: vi.fn()
    };

    const service = new ProjectsService(
      prismaService as never,
      limitedConfigService as never,
      auditService as never,
      projectPolicyService as never
    );

    let caughtError: BadRequestException | undefined;

    try {
      await service.exportProjects(response as never, {
        limit: 10,
        includeArchived: false
      });
    } catch (error) {
      caughtError = error as BadRequestException;
    }

    expect(caughtError).toBeInstanceOf(BadRequestException);
    expect(caughtError?.getResponse()).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('synchronous export limit'),
        errors: expect.arrayContaining([
          expect.objectContaining({
            code: 'export_limit_exceeded'
          })
        ])
      })
    );
    expect(response.write).not.toHaveBeenCalled();
    expect(response.end).not.toHaveBeenCalled();
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

  it('uses the same narrow creator select for getProject', async () => {
    const prismaService = {
      project: {
        findUnique: vi.fn().mockResolvedValue(createProjectRecord())
      }
    };

    const service = new ProjectsService(
      prismaService as never,
      configService as never,
      auditService as never,
      projectPolicyService as never
    );

    const project = await service.getProject('project_1');

    expect(project.creator.email).toBe('owner@example.com');
    expect(prismaService.project.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          creator: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              email: true,
              name: true,
              role: true
            })
          })
        })
      })
    );
  });
});
