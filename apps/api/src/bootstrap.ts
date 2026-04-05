import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication, Type, ValidationError } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { getAllowedOrigins } from './common/config/allowed-origins';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { flattenValidationErrors } from './common/validation/validation-errors';
import { initializeOpenTelemetry } from './modules/observability/otel.bootstrap';
import { PrismaService } from './modules/prisma/prisma.service';

async function configureApp(app: INestApplication) {
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
  const otelSdk = await initializeOpenTelemetry(configService);
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
  const shutdownObservability = async () => {
    if (otelSdk) {
      await otelSdk.shutdown();
    }
  };

  process.once('SIGINT', () => {
    void shutdownObservability();
  });
  process.once('SIGTERM', () => {
    void shutdownObservability();
  });

  const port = Number(configService.get<string>('API_PORT', '4000'));
  await app.listen(port, '0.0.0.0');
  console.info(JSON.stringify({ level: 'info', message: 'api.started', port }));
}

export async function bootstrapApp(moduleClass: Type<unknown>) {
  const app = await NestFactory.create(moduleClass, { bufferLogs: true });
  await configureApp(app);
  return app;
}
