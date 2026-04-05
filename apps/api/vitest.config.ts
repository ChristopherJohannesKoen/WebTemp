import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    hookTimeout: 30_000,
    maxWorkers: 1,
    pool: 'threads',
    testTimeout: 30_000
  }
});
