import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:3100'
  },
  webServer: {
    command: 'npm run dev --workspace=@apps/web -- --hostname 127.0.0.1 --port 3100',
    env: {
      API_ORIGIN: 'http://127.0.0.1:5999'
    },
    reuseExistingServer: !process.env.CI,
    url: 'http://127.0.0.1:3100'
  }
});
