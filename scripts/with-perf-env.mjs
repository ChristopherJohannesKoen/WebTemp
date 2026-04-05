import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const cwd = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');

for (const [envPath, override] of [
  [path.join(rootDir, '.env.example'), false],
  [path.join(rootDir, '.env'), true],
  [path.join(rootDir, '.env.perf.example'), true],
  [path.join(rootDir, '.env.perf'), true]
]) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override });
  }
}

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('No command provided to scripts/with-perf-env.mjs');
  process.exit(1);
}

const child = spawn(command, args, {
  cwd,
  env: process.env,
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
