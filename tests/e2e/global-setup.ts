import { resetDatabase } from './support/e2e-db';
import { loadE2EEnv } from './support/e2e-env';

async function globalSetup() {
  loadE2EEnv();
  await resetDatabase('baseline');
}

export default globalSetup;
