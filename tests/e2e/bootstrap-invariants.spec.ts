import { expect, test } from '@playwright/test';
import {
  countBootstrapStates,
  countOwners,
  getBootstrapState,
  resetDatabase,
  runSeed
} from './support/e2e-db';

test.describe('bootstrap ownership invariants', () => {
  test.beforeEach(async () => {
    await resetDatabase('empty');
  });

  test('concurrent seed runs establish bootstrap exactly once', async () => {
    const [firstSeed, secondSeed] = await Promise.all([runSeed(), runSeed()]);

    expect(firstSeed.exitCode).toBe(0);
    expect(secondSeed.exitCode).toBe(0);
    expect(await countBootstrapStates()).toBe(1);
    expect(await countOwners()).toBe(1);

    const bootstrapState = await getBootstrapState();

    expect(bootstrapState?.bootstrapOwner.email).toBe('owner@example.com');
  });

  test('bootstrap does not silently migrate to a new configured owner email', async () => {
    const initialSeed = await runSeed();
    expect(initialSeed.exitCode).toBe(0);

    const conflictingSeed = await runSeed({
      SEED_OWNER_EMAIL: 'unexpected-owner@example.com'
    });

    expect(conflictingSeed.exitCode).not.toBe(0);
    expect(`${conflictingSeed.stdout}\n${conflictingSeed.stderr}`).toContain(
      'Bootstrap owner mismatch'
    );

    const bootstrapState = await getBootstrapState();
    expect(bootstrapState?.bootstrapOwner.email).toBe('owner@example.com');
    expect(await countBootstrapStates()).toBe(1);
    expect(await countOwners()).toBe(1);
  });
});
