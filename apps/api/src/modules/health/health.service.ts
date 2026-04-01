import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prismaService: PrismaService) {}

  async status() {
    await this.prismaService.$queryRawUnsafe('SELECT 1');

    return {
      status: 'ok' as const,
      service: 'api' as const,
      database: 'up' as const,
      timestamp: new Date().toISOString()
    };
  }
}
