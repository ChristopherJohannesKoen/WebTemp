import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import type { ProjectListResponse, SessionUser } from '@packages/shared';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProjectStatus, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { decodeProjectCursor, encodeProjectCursor } from './project-cursor';
import { ProjectPolicyService } from './project-policy.service';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { ListProjectsDto } from './dto/list-projects.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';

type ProjectRecord = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  isArchived: boolean;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  creator: {
    id: string;
    email: string;
    name: string;
    role: Role;
  };
};

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly projectPolicyService: ProjectPolicyService
  ) {}

  async listProjects(query: ListProjectsDto): Promise<ProjectListResponse> {
    const cursor = decodeProjectCursor(query.cursor);
    const pageSize = query.limit;
    const items = await this.prismaService.project.findMany({
      where: this.buildProjectWhere(query, cursor),
      include: { creator: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1
    });

    const hasMore = items.length > pageSize;
    const pageItems = hasMore ? items.slice(0, pageSize) : items;
    const lastItem = pageItems.at(-1);

    return {
      items: pageItems.map((project) => this.serializeProject(project)),
      nextCursor:
        hasMore && lastItem
          ? encodeProjectCursor({
              id: lastItem.id,
              updatedAt: lastItem.updatedAt
            })
          : null,
      hasMore
    };
  }

  async exportProjects(response: Response, query: ListProjectsDto) {
    const total = await this.prismaService.project.count({
      where: this.buildProjectWhere({
        ...query,
        cursor: undefined
      })
    });

    if (total > this.getExportSyncLimit()) {
      throw new BadRequestException(
        `Filtered export exceeds the synchronous export limit of ${this.getExportSyncLimit()} rows. Narrow the filters or add async exports.`
      );
    }

    response.write(
      ['id', 'name', 'status', 'archived', 'creatorEmail', 'createdAt', 'updatedAt', 'description']
        .map((value) => this.escapeCsvCell(value))
        .join(',') + '\n'
    );

    let cursor = undefined as { id: string; updatedAt: Date } | undefined;
    const batchSize = 250;

    while (true) {
      const batch = await this.prismaService.project.findMany({
        where: this.buildProjectWhere(
          {
            ...query,
            cursor: undefined,
            limit: batchSize
          },
          cursor
        ),
        include: { creator: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: batchSize
      });

      if (batch.length === 0) {
        break;
      }

      for (const project of batch) {
        response.write(
          [
            project.id,
            project.name,
            project.status,
            String(project.isArchived),
            project.creator.email,
            project.createdAt.toISOString(),
            project.updatedAt.toISOString(),
            project.description ?? ''
          ]
            .map((value) => this.escapeCsvCell(value))
            .join(',') + '\n'
        );
      }

      if (batch.length < batchSize) {
        break;
      }

      const lastProject = batch.at(-1)!;
      cursor = {
        id: lastProject.id,
        updatedAt: lastProject.updatedAt
      };
    }

    response.end();
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

    await this.projectPolicyService.assertCanMutateProject(
      currentUser,
      existingProject,
      dto.isArchived === undefined ? 'update' : 'archive'
    );

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

    await this.projectPolicyService.assertCanMutateProject(currentUser, project, 'delete');

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

  private buildProjectWhere(
    query: Pick<ListProjectsDto, 'includeArchived' | 'search' | 'status'> & {
      cursor?: string | undefined;
      limit?: number;
    },
    cursor = decodeProjectCursor(query.cursor)
  ): Prisma.ProjectWhereInput {
    const clauses: Prisma.ProjectWhereInput[] = [];

    if (!query.includeArchived) {
      clauses.push({ isArchived: false });
    }

    if (query.status) {
      clauses.push({ status: query.status });
    }

    if (query.search?.trim()) {
      clauses.push({
        OR: [
          { name: { contains: query.search.trim(), mode: 'insensitive' } },
          { description: { contains: query.search.trim(), mode: 'insensitive' } }
        ]
      });
    }

    if (cursor) {
      clauses.push({
        OR: [
          { updatedAt: { lt: cursor.updatedAt } },
          {
            updatedAt: cursor.updatedAt,
            id: { lt: cursor.id }
          }
        ]
      });
    }

    if (clauses.length === 0) {
      return {};
    }

    if (clauses.length === 1) {
      return clauses[0] ?? {};
    }

    return {
      AND: clauses
    };
  }

  private escapeCsvCell(value: string) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  private getExportSyncLimit() {
    return Number(this.configService.get<string>('EXPORT_SYNC_LIMIT', '5000'));
  }

  private serializeProject(project: ProjectRecord) {
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
