import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { config as loadEnv } from 'dotenv';

let loaded = false;

function rootPath(...segments: string[]) {
  return path.join(process.cwd(), ...segments);
}

function loadIfPresent(envPath: string, override: boolean) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override });
  }
}

export function loadE2EEnv() {
  if (loaded) {
    return process.env;
  }

  loadIfPresent(rootPath('.env.example'), false);
  loadIfPresent(rootPath('.env'), true);
  loadIfPresent(rootPath('.env.e2e.example'), true);
  loadIfPresent(rootPath('.env.e2e'), true);

  process.env.NODE_ENV ??= 'test';
  process.env.APP_ENV ??= 'test';
  process.env.APP_URL ??= 'http://127.0.0.1:3100';
  process.env.API_ORIGIN ??= 'http://127.0.0.1:4100';
  process.env.ALLOWED_ORIGINS ??= 'http://127.0.0.1:3100';
  process.env.ALLOW_MISSING_ORIGIN_FOR_DEV ??= 'false';
  process.env.API_PORT ??= '4100';
  process.env.WEB_PORT ??= '3100';
  process.env.TEMPLATE_E2E ??= 'true';
  process.env.SESSION_TOUCH_INTERVAL_MS ??= '600000';
  process.env.POSTGRES_DB ??= 'ultimate_template_e2e';
  process.env.DATABASE_URL ??=
    'postgresql://postgres:postgres@127.0.0.1:5432/ultimate_template_e2e?schema=public';

  loaded = true;
  return process.env;
}

export function getE2EEnv() {
  loadE2EEnv();

  return {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? 'test',
    APP_ENV: process.env.APP_ENV ?? 'test',
    APP_URL: process.env.APP_URL ?? 'http://127.0.0.1:3100',
    API_ORIGIN: process.env.API_ORIGIN ?? 'http://127.0.0.1:4100',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? 'http://127.0.0.1:3100',
    ALLOW_MISSING_ORIGIN_FOR_DEV: process.env.ALLOW_MISSING_ORIGIN_FOR_DEV ?? 'false',
    API_PORT: process.env.API_PORT ?? '4100',
    WEB_PORT: process.env.WEB_PORT ?? '3100',
    TEMPLATE_E2E: process.env.TEMPLATE_E2E ?? 'true',
    SESSION_TOUCH_INTERVAL_MS: process.env.SESSION_TOUCH_INTERVAL_MS ?? '600000',
    DATABASE_URL:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@127.0.0.1:5432/ultimate_template_e2e?schema=public'
  };
}

export function getE2EDatabaseUrl() {
  return getE2EEnv().DATABASE_URL;
}

export function getE2EDatabaseName() {
  const databaseUrl = new URL(getE2EDatabaseUrl());
  return databaseUrl.pathname.replace(/^\//, '');
}

export function getAdminDatabaseUrl() {
  const adminUrl = new URL(getE2EDatabaseUrl());
  adminUrl.pathname = '/postgres';
  return adminUrl.toString();
}
