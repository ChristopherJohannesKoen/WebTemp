import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { SessionUser } from '@packages/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ListUsersDto } from './dto/list-users.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listUsers(query: ListUsersDto) {
    const [total, items] = await this.prismaService.$transaction([
      this.prismaService.user.count(),
      this.prismaService.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      })
    ]);

    return {
      items: items.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      })),
      page: query.page,
      pageSize: query.pageSize,
      total
    };
  }

  async updateRole(actor: SessionUser, targetId: string, dto: UpdateRoleDto) {
    if (actor.role !== 'owner') {
      throw new ForbiddenException('Only the owner can change roles.');
    }

    const target = await this.prismaService.user.findUnique({
      where: { id: targetId }
    });

    if (!target) {
      throw new NotFoundException('User not found.');
    }

    if (target.role === 'owner') {
      throw new BadRequestException('The owner role cannot be reassigned.');
    }

    const updatedUser = await this.prismaService.user.update({
      where: { id: targetId },
      data: { role: dto.role }
    });

    await this.auditService.log({
      actorId: actor.id,
      action: 'user.role_updated',
      targetType: 'user',
      targetId: updatedUser.id,
      metadata: { role: dto.role }
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt.toISOString(),
      updatedAt: updatedUser.updatedAt.toISOString()
    };
  }
}
