import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../src/common/config/environment.validation';

const baseEnvironment = {
  NODE_ENV: 'development',
  APP_ENV: 'local',
  APP_URL: 'http://localhost:3000',
  API_ORIGIN: 'http://localhost:4000',
  ALLOWED_ORIGINS: '',
  ALLOW_MISSING_ORIGIN_FOR_DEV: 'false',
  API_PORT: '4000',
  API_PREFIX: 'api',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ultimate_template?schema=public',
  SESSION_COOKIE_NAME: 'ultimate_template_session',
  SESSION_COOKIE_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  ARGON2_MEMORY_COST: '19456',
  RATE_LIMIT_WINDOW_MS: '60000',
  RATE_LIMIT_MAX: '120',
  SESSION_ROTATION_MS: '43200000',
  SESSION_TOUCH_INTERVAL_MS: '600000',
  SESSION_MAX_ACTIVE: '5',
  IDEMPOTENCY_TTL_SECONDS: '86400',
  IDEMPOTENCY_CLEANUP_INTERVAL_MS: '900000',
  IDEMPOTENCY_CLEANUP_BATCH_SIZE: '500',
  EXPORT_SYNC_LIMIT: '5000',
  EXPOSE_DEV_RESET_DETAILS: 'false',
  SEED_OWNER_EMAIL: 'owner@example.com',
  SEED_OWNER_PASSWORD: 'ChangeMe123!',
  FEATURE_EMAIL: 'false',
  FEATURE_STORAGE: 'false',
  FEATURE_CACHE: 'false',
  FEATURE_OBSERVABILITY: 'false'
};

describe('validateEnvironment', () => {
  it('derives APP_ENV from NODE_ENV when it is omitted', () => {
    const result = validateEnvironment({
      ...baseEnvironment,
      NODE_ENV: 'production',
      APP_ENV: undefined
    });

    expect(result.APP_ENV).toBe('production');
  });

  it('rejects ALLOW_MISSING_ORIGIN_FOR_DEV outside local app environments', () => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        APP_ENV: 'staging',
        ALLOW_MISSING_ORIGIN_FOR_DEV: 'true'
      })
    ).toThrow('ALLOW_MISSING_ORIGIN_FOR_DEV can only be enabled when APP_ENV=local.');
  });

  it('rejects EXPOSE_DEV_RESET_DETAILS outside local or test app environments', () => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        APP_ENV: 'production',
        EXPOSE_DEV_RESET_DETAILS: 'true'
      })
    ).toThrow('EXPOSE_DEV_RESET_DETAILS can only be enabled when APP_ENV=local or APP_ENV=test.');
  });

  it('allows reset detail exposure in test app environments', () => {
    const result = validateEnvironment({
      ...baseEnvironment,
      NODE_ENV: 'test',
      APP_ENV: 'test',
      EXPOSE_DEV_RESET_DETAILS: 'true'
    });

    expect(result.APP_ENV).toBe('test');
    expect(result.EXPOSE_DEV_RESET_DETAILS).toBe(true);
  });

  it('allows missing origin only for local development environments', () => {
    const result = validateEnvironment({
      ...baseEnvironment,
      APP_ENV: 'local',
      ALLOW_MISSING_ORIGIN_FOR_DEV: 'true'
    });

    expect(result.ALLOW_MISSING_ORIGIN_FOR_DEV).toBe(true);
  });

  it('rejects enterprise identity in production when no provider is configured', () => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        NODE_ENV: 'production',
        APP_ENV: 'production',
        ENTERPRISE_IDENTITY_ENABLED: 'true'
      })
    ).toThrow('enterprise identity is enabled but no OIDC or SAML provider is configured');
  });

  it('accepts an OIDC-backed enterprise production configuration', () => {
    const result = validateEnvironment({
      ...baseEnvironment,
      NODE_ENV: 'production',
      APP_ENV: 'production',
      ENTERPRISE_IDENTITY_ENABLED: 'true',
      ENTERPRISE_DEFAULT_PROVIDER_SLUG: 'enterprise-oidc',
      OIDC_PROVIDER_SLUG: 'enterprise-oidc',
      OIDC_ISSUER: 'https://idp.example.com',
      OIDC_CLIENT_ID: 'client-id',
      OIDC_CLIENT_SECRET: 'super-secret'
    });

    expect(result.ENTERPRISE_IDENTITY_ENABLED).toBe(true);
    expect(result.OIDC_PROVIDER_SLUG).toBe('enterprise-oidc');
  });
});
