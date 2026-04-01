import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
        API_PORT: Joi.number().default(4000),
        API_PREFIX: Joi.string().default('api'),
        DATABASE_URL: Joi.string().required()
      })
    })
  ],
  controllers: [HealthController],
  providers: [PrismaService]
})
export class AppModule {}
