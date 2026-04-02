import { expect, test } from '@playwright/test';
import { resetDatabase } from './support/e2e-db';
import { signUp } from './support/auth';

test.beforeEach(async () => {
  await resetDatabase('empty');
});

test('promotes the first signup to owner in an empty database', async ({ page }) => {
  await signUp(page, {
    name: 'First Owner',
    email: 'first-owner@example.com',
    password: 'FirstOwner123!'
  });

  await expect(page.getByRole('heading', { name: /Welcome back, First Owner\./ })).toBeVisible();
  await page.goto('/app/admin/users');
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
});
