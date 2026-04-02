import { PrismaClient } from '@prisma/client';
import { spawn } from 'node:child_process';
import process from 'node:process';

function createPrismaClient(url) {
  return new PrismaClient({
    datasources: {
      db: {
        url
      }
    }
  });
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for the E2E API bootstrap.');
  }

  return databaseUrl;
}

function getAdminDatabaseUrl() {
  const adminUrl = new URL(getDatabaseUrl());
  adminUrl.pathname = '/postgres';
  return adminUrl.toString();
}

function getDatabaseName() {
  return new URL(getDatabaseUrl()).pathname.replace(/^\//, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPostgres(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    const prisma = createPrismaClient(getAdminDatabaseUrl());

    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      lastError = error;
      await sleep(1_000);
    } finally {
      await prisma.$disconnect();
    }
  }

  throw new Error(`Timed out waiting for PostgreSQL. Last error: ${String(lastError)}`);
}

async function ensureDatabaseExists() {
  const prisma = createPrismaClient(getAdminDatabaseUrl());
  const databaseName = getDatabaseName();

  try {
    const existing = await prisma.$queryRaw`
      SELECT datname
      FROM pg_database
      WHERE datname = ${databaseName}
    `;

    if (Array.isArray(existing) && existing.length > 0) {
      return;
    }

    const escapedName = databaseName.replaceAll('"', '""');
    await prisma.$executeRawUnsafe(`CREATE DATABASE "${escapedName}"`);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('already exists')) {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: process.cwd(),
      env: process.env,
      shell: true,
      stdio: 'inherit'
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed with exit code ${code}: ${command}`));
    });
  });
}

async function main() {
  await waitForPostgres();
  await ensureDatabaseExists();
  await runCommand('npm run prisma:migrate:deploy --workspace=@packages/db');
  await runCommand('npx tsc -p apps/api/tsconfig.build.json --incremental false');

  const child = spawn('node ./apps/api/dist/main.js', {
    cwd: process.cwd(),
    env: process.env,
    shell: true,
    stdio: 'inherit'
  });

  const forwardSignal = (signal) => {
    child.kill(signal);
  };

  process.on('SIGINT', forwardSignal);
  process.on('SIGTERM', forwardSignal);

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
