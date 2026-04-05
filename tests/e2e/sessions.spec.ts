import { expect, test } from '@playwright/test';
import { resetDatabase } from './support/e2e-db';
import { openSecondarySession, seededUsers, signIn } from './support/auth';

test.beforeEach(async () => {
  await resetDatabase('baseline');
});

test('shows the current session and lets the user sign out from settings', async ({ page }) => {
  await signIn(page, seededUsers.owner);

  await page.goto('/app/settings');
  await expect(page.getByTestId('session-management')).toBeVisible();
  await expect(page.locator('[data-testid="session-row"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="session-row"][data-current="true"]')).toHaveCount(1);

  await page.getByTestId('current-session-sign-out').click();
  await expect(page).toHaveURL(/\/login$/);
});

test('revokes another active session and forces that browser back to login', async ({
  browser,
  page
}) => {
  await signIn(page, seededUsers.owner);
  const { context: secondaryContext, page: secondaryPage } = await openSecondarySession(
    browser,
    seededUsers.owner
  );

  try {
    await page.goto('/app/settings');
    await expect(page.locator('[data-testid="session-row"]')).toHaveCount(2);

    const otherSessionRow = page
      .locator('[data-testid="session-row"][data-current="false"]')
      .first();
    await otherSessionRow.getByTestId('revoke-session').click();
    await expect(page.locator('[data-testid="session-row"]')).toHaveCount(1);

    await secondaryPage.goto('/app/settings');
    await expect(secondaryPage).toHaveURL(/\/login$/);
  } finally {
    await secondaryContext.close();
  }
});

test('logout-all invalidates every active session', async ({ browser, page }) => {
  await signIn(page, seededUsers.owner);
  const { context: secondaryContext, page: secondaryPage } = await openSecondarySession(
    browser,
    seededUsers.owner
  );

  try {
    await page.goto('/app/settings');
    await page.getByTestId('logout-all-sessions').click();
    await expect(page).toHaveURL(/\/login$/);

    await secondaryPage.goto('/app');
    await expect(secondaryPage).toHaveURL(/\/login$/);
  } finally {
    await secondaryContext.close();
  }
});
