import * as Joi from 'joi';
import {
  appEnvironmentValues,
  canAllowMissingOrigin,
  canExposeResetDetails,
  normalizeAppEnvironment
} from './app-environment';

type Environment = Record<string, unknown>;

const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  APP_ENV: Joi.string()
    .valid(...appEnvironmentValues)
    .default('local'),
  APP_URL: Joi.string().uri().required(),
  API_ORIGIN: Joi.string().uri().required(),
  ALLOWED_ORIGINS: Joi.string().allow('').default(''),
  ALLOW_MISSING_ORIGIN_FOR_DEV: Joi.boolean().truthy('true').falsy('false').default(false),
  API_PORT: Joi.number().default(4000),
  API_PREFIX: Joi.string().default('api'),
  DATABASE_URL: Joi.string().required(),
  SESSION_COOKIE_NAME: Joi.string().default('ultimate_template_session'),
  ARGON2_MEMORY_COST: Joi.number().default(19456),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  RATE_LIMIT_MAX: Joi.number().default(120),
  SESSION_ROTATION_MS: Joi.number().default(1000 * 60 * 60 * 12),
  SESSION_TOUCH_INTERVAL_MS: Joi.number().default(1000 * 60 * 10),
  SESSION_MAX_ACTIVE: Joi.number().integer().min(1).default(5),
  IDEMPOTENCY_TTL_SECONDS: Joi.number().integer().min(60).default(86400),
  IDEMPOTENCY_CLEANUP_INTERVAL_MS: Joi.number().integer().min(60000).default(900000),
  IDEMPOTENCY_CLEANUP_BATCH_SIZE: Joi.number().integer().min(1).default(500),
  EXPORT_SYNC_LIMIT: Joi.number().integer().min(100).default(5000),
  EXPOSE_DEV_RESET_DETAILS: Joi.boolean().truthy('true').falsy('false').default(false),
  SEED_OWNER_EMAIL: Joi.string().email().required(),
  SEED_OWNER_PASSWORD: Joi.string().min(8).required(),
  FEATURE_EMAIL: Joi.boolean().truthy('true').falsy('false').default(false),
  FEATURE_STORAGE: Joi.boolean().truthy('true').falsy('false').default(false),
  FEATURE_CACHE: Joi.boolean().truthy('true').falsy('false').default(false),
  FEATURE_OBSERVABILITY: Joi.boolean().truthy('true').falsy('false').default(false),
  SMTP_HOST: Joi.string().allow('').optional(),
  SMTP_PORT: Joi.number().allow('', null).optional(),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASSWORD: Joi.string().allow('').optional(),
  REDIS_URL: Joi.string().allow('').optional(),
  S3_BUCKET: Joi.string().allow('').optional(),
  S3_REGION: Joi.string().allow('').optional(),
  S3_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  S3_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().allow('').optional()
});

function assertRequiredWhenEnabled(
  environment: Environment,
  featureFlag: string,
  requiredKeys: string[]
) {
  if (!environment[featureFlag]) {
    return;
  }

  const missingKeys = requiredKeys.filter((key) => {
    const value = environment[key];
    return value === undefined || value === null || value === '';
  });

  if (missingKeys.length > 0) {
    throw new Error(
      `${featureFlag} is enabled but the following environment variables are missing: ${missingKeys.join(', ')}`
    );
  }
}

export function validateEnvironment(rawEnvironment: Environment) {
  const normalizedRawEnvironment = {
    ...rawEnvironment,
    APP_ENV: normalizeAppEnvironment(
      rawEnvironment.APP_ENV,
      String(rawEnvironment.NODE_ENV ?? 'development')
    )
  };

  const { error, value } = environmentSchema.validate(normalizedRawEnvironment, {
    abortEarly: false,
    convert: true,
    allowUnknown: true
  });

  if (error) {
    throw new Error(`Environment validation failed: ${error.message}`);
  }

  const allowedOrigins = String(value.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of allowedOrigins) {
    const { error: originError } = Joi.string().uri().validate(origin);

    if (originError) {
      throw new Error(
        `Environment validation failed: ALLOWED_ORIGINS contains an invalid origin: ${origin}`
      );
    }
  }

  assertRequiredWhenEnabled(value, 'FEATURE_EMAIL', [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASSWORD'
  ]);
  assertRequiredWhenEnabled(value, 'FEATURE_STORAGE', [
    'S3_BUCKET',
    'S3_REGION',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY'
  ]);
  assertRequiredWhenEnabled(value, 'FEATURE_CACHE', ['REDIS_URL']);
  assertRequiredWhenEnabled(value, 'FEATURE_OBSERVABILITY', ['OTEL_EXPORTER_OTLP_ENDPOINT']);

  if (value.ALLOW_MISSING_ORIGIN_FOR_DEV && !canAllowMissingOrigin(value.APP_ENV)) {
    throw new Error(
      'Environment validation failed: ALLOW_MISSING_ORIGIN_FOR_DEV can only be enabled when APP_ENV=local.'
    );
  }

  if (value.EXPOSE_DEV_RESET_DETAILS && !canExposeResetDetails(value.APP_ENV)) {
    throw new Error(
      'Environment validation failed: EXPOSE_DEV_RESET_DETAILS can only be enabled when APP_ENV=local or APP_ENV=test.'
    );
  }

  return value;
}
