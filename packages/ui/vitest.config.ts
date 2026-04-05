import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    fileParallelism: false,
    maxWorkers: 1,
    pool: 'threads'
  }
});
