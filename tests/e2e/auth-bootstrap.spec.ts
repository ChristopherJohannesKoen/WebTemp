import { expect, test } from '@playwright/test';
import { resetDatabase } from './support/e2e-db';
import { seededUsers, signIn, signUp } from './support/auth';

test('keeps the first public signup as a member in an empty database', async ({ page }) => {
  await resetDatabase('empty');

  await signUp(page, {
    name: 'First Member',
    email: 'first-member@example.com',
    password: 'FirstMember123!'
  });

  await expect(page.getByRole('heading', { name: /Welcome back, First Member\./ })).toBeVisible();
  await page.goto('/app/admin/users');
  await expect(page).toHaveURL(/\/app$/);
});

test('uses the seeded owner as the baseline bootstrap path', async ({ page }) => {
  await resetDatabase('baseline');

  await signIn(page, seededUsers.owner);
  await page.goto('/app/admin/users');
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
});
