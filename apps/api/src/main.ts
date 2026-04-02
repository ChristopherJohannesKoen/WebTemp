import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { ValidationError } from 'class-validator';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { getAllowedOrigins } from './common/config/allowed-origins';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { flattenValidationErrors } from './common/validation/validation-errors';
import { AppModule } from './modules/app.module';
import { PrismaService } from './modules/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(cookieParser());
  app.use(helmet());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (validationErrors: ValidationError[]) =>
        new BadRequestException({
          message: 'Validation failed',
          errors: flattenValidationErrors(validationErrors)
        })
    })
  );

  const configService = app.get(ConfigService);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  const sessionCookieName = configService.get<string>(
    'SESSION_COOKIE_NAME',
    'ultimate_template_session'
  );

  app.enableCors({
    origin: getAllowedOrigins(configService),
    credentials: true
  });
  app.setGlobalPrefix(apiPrefix);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ultimate Template API')
    .setDescription('Docker-first SaaS template API with session auth, RBAC, and Projects CRUD')
    .setVersion('2.0.0')
    .addCookieAuth(sessionCookieName, {
      type: 'apiKey',
      in: 'cookie',
      name: sessionCookieName
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const port = Number(configService.get<string>('API_PORT', '4000'));
  await app.listen(port, '0.0.0.0');
  console.info(JSON.stringify({ level: 'info', message: 'api.started', port }));
}

bootstrap();
