import { defineConfig } from '@playwright/test';
import { getE2EEnv, loadE2EEnv } from './tests/e2e/support/e2e-env';

loadE2EEnv();
const e2eEnv = getE2EEnv();

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: e2eEnv.APP_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium'
      }
    }
  ],
  webServer: [
    {
      command: 'node ./tests/e2e/start-api.mjs',
      env: e2eEnv,
      reuseExistingServer: false,
      timeout: 240_000,
      url: `${e2eEnv.API_ORIGIN}/api/health`
    },
    {
      command: `npm run dev --workspace=@apps/web -- --hostname 127.0.0.1 --port ${e2eEnv.WEB_PORT}`,
      env: e2eEnv,
      reuseExistingServer: false,
      timeout: 240_000,
      url: e2eEnv.APP_URL
    }
  ]
});
