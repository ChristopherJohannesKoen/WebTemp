import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsService } from '../src/modules/projects/projects.service';

const auditService = {
  log: vi.fn()
};

const creator = {
  id: 'user_owner',
  email: 'owner@example.com',
  name: 'Owner User',
  role: 'owner'
};

function createProjectRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'project_1',
    name: 'Starter project',
    description: 'Template-friendly project',
    status: 'active',
    isArchived: false,
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

  it('lists paginated projects', async () => {
    const prismaService = {
      project: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([createProjectRecord()])
      },
      $transaction: vi.fn().mockResolvedValue([1, [createProjectRecord()]])
    };

    const service = new ProjectsService(prismaService as never, auditService as never);
    const result = await service.listProjects({
      page: 1,
      pageSize: 10,
      includeArchived: false
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.creator.email).toBe('owner@example.com');
  });

  it('exports projects as CSV', async () => {
    const prismaService = {
      project: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          createProjectRecord({
            description: 'Handles "quotes" and commas, too.'
          })
        ])
      },
      $transaction: vi.fn().mockResolvedValue([
        1,
        [
          createProjectRecord({
            description: 'Handles "quotes" and commas, too.'
          })
        ]
      ])
    };

    const service = new ProjectsService(prismaService as never, auditService as never);
    const csv = await service.exportProjects({
      page: 1,
      pageSize: 10,
      includeArchived: false
    });

    expect(csv).toContain('"Handles ""quotes"" and commas, too."');
    expect(csv).toContain('"owner@example.com"');
  });

  it('logs archive actions when a project is archived', async () => {
    const prismaService = {
      project: {
        findUnique: vi.fn().mockResolvedValue(createProjectRecord()),
        update: vi.fn().mockResolvedValue(createProjectRecord({ isArchived: true }))
      }
    };

    const service = new ProjectsService(prismaService as never, auditService as never);

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
});
