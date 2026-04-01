import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    const shutdown = async () => {
      await app.close();
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
}
