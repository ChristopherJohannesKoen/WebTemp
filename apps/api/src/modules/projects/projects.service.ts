import { Injectable, NotFoundException } from '@nestjs/common';
import type { SessionUser } from '@packages/shared';
import { Prisma, ProjectStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { ListProjectsDto } from './dto/list-projects.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listProjects(query: ListProjectsDto) {
    const where: Prisma.ProjectWhereInput = {
      ...(query.includeArchived ? {} : { isArchived: false }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } }
            ]
          }
        : {})
    };

    const [total, items] = await this.prismaService.$transaction([
      this.prismaService.project.count({ where }),
      this.prismaService.project.findMany({
        where,
        include: { creator: true },
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      })
    ]);

    return {
      items: items.map((project) => this.serializeProject(project)),
      page: query.page,
      pageSize: query.pageSize,
      total
    };
  }

  async exportProjects(query: ListProjectsDto) {
    const data = await this.listProjects({
      ...query,
      page: 1,
      pageSize: 500
    });

    const rows = [
      ['id', 'name', 'status', 'archived', 'creatorEmail', 'createdAt', 'updatedAt', 'description'],
      ...data.items.map((project) => [
        project.id,
        project.name,
        project.status,
        String(project.isArchived),
        project.creator.email,
        project.createdAt,
        project.updatedAt,
        project.description ?? ''
      ])
    ];

    return rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');
  }

  async getProject(projectId: string) {
    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: { creator: true }
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    return this.serializeProject(project);
  }

  async createProject(currentUser: SessionUser, dto: CreateProjectDto) {
    const project = await this.prismaService.project.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        status: dto.status ?? ProjectStatus.active,
        creatorId: currentUser.id
      },
      include: { creator: true }
    });

    await this.auditService.log({
      actorId: currentUser.id,
      action: 'project.created',
      targetType: 'project',
      targetId: project.id
    });

    return this.serializeProject(project);
  }

  async updateProject(currentUser: SessionUser, projectId: string, dto: UpdateProjectDto) {
    const existingProject = await this.prismaService.project.findUnique({
      where: { id: projectId }
    });

    if (!existingProject) {
      throw new NotFoundException('Project not found.');
    }

    const project = await this.prismaService.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.isArchived !== undefined ? { isArchived: dto.isArchived } : {})
      },
      include: { creator: true }
    });

    const action =
      dto.isArchived === undefined
        ? 'project.updated'
        : dto.isArchived
          ? 'project.archived'
          : 'project.unarchived';

    await this.auditService.log({
      actorId: currentUser.id,
      action,
      targetType: 'project',
      targetId: project.id
    });

    return this.serializeProject(project);
  }

  async deleteProject(currentUser: SessionUser, projectId: string) {
    const project = await this.prismaService.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    await this.prismaService.project.delete({
      where: { id: projectId }
    });

    await this.auditService.log({
      actorId: currentUser.id,
      action: 'project.deleted',
      targetType: 'project',
      targetId: projectId
    });

    return { ok: true };
  }

  private serializeProject(project: {
    id: string;
    name: string;
    description: string | null;
    status: ProjectStatus;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
    creator: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }) {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      isArchived: project.isArchived,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      creator: {
        id: project.creator.id,
        email: project.creator.email,
        name: project.creator.name,
        role: project.creator.role
      }
    };
  }
}
