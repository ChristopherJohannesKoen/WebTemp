import process from 'node:process';

process.env.E2E_PROFILE = 'enterprise';

await import('./with-e2e-env.mjs');
