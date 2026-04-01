import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async me(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.prismaService.user.update({
      where: { id: userId },
      data: { name: dto.name.trim() }
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'user.profile_updated',
      targetType: 'user',
      targetId: user.id
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }
}
