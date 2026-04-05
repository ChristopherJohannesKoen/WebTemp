import { expect, test } from '@playwright/test';
import { countOwners, resetDatabase } from './support/e2e-db';
import { openSecondarySession, seededUsers, signIn } from './support/auth';

test.describe('admin concurrency and stale-role enforcement', () => {
  test.beforeEach(async () => {
    await resetDatabase('baseline');
  });

  test('revokes active admin access on the next privileged request without re-authentication', async ({
    browser,
    page
  }) => {
    await signIn(page, seededUsers.owner);
    const adminSession = await openSecondarySession(browser, seededUsers.admin);

    await adminSession.page.goto('/app/admin/users');
    await expect(adminSession.page.getByRole('heading', { name: 'Users' })).toBeVisible();

    await page.goto('/app/admin/users');
    const adminCard = page.getByTestId(`admin-user-${seededUsers.admin.email}`);
    await adminCard.getByTestId('role-select').selectOption('member');
    await adminCard.getByTestId('role-submit').click();
    await expect(adminCard.getByTestId('role-select')).toHaveValue('member');

    await adminSession.page.goto('/app/admin/users');
    await expect(adminSession.page.getByTestId('protected-route-forbidden')).toBeVisible();

    await adminSession.page.goto('/app');
    await expect(adminSession.page.getByRole('link', { name: 'Admin' })).toHaveCount(0);

    await adminSession.context.close();
  });

  test('keeps at least one owner during conflicting owner demotion attempts', async ({
    browser,
    page
  }) => {
    await signIn(page, seededUsers.owner);
    await page.goto('/app/admin/users');

    const adminCard = page.getByTestId(`admin-user-${seededUsers.admin.email}`);
    await adminCard.getByTestId('role-select').selectOption('owner');
    await adminCard.getByTestId('role-submit').click();
    await expect(adminCard.getByTestId('role-select')).toHaveValue('owner');

    const secondOwnerSession = await openSecondarySession(browser, seededUsers.admin);
    await page.goto('/app/admin/users');
    await secondOwnerSession.page.goto('/app/admin/users');

    const firstOwnerTargetCard = page.getByTestId(`admin-user-${seededUsers.admin.email}`);
    const secondOwnerTargetCard = secondOwnerSession.page.getByTestId(
      `admin-user-${seededUsers.owner.email}`
    );

    await firstOwnerTargetCard.getByTestId('role-select').selectOption('member');
    await secondOwnerTargetCard.getByTestId('role-select').selectOption('member');

    const [firstResponse, secondResponse] = await Promise.all([
      Promise.all([
        page.waitForResponse(
          (candidate) =>
            candidate.request().method() === 'PATCH' &&
            candidate.url().includes('/api/admin/users/') &&
            candidate.url().endsWith('/role')
        ),
        firstOwnerTargetCard.getByTestId('role-submit').click()
      ]).then(([response]) => response),
      Promise.all([
        secondOwnerSession.page.waitForResponse(
          (candidate) =>
            candidate.request().method() === 'PATCH' &&
            candidate.url().includes('/api/admin/users/') &&
            candidate.url().endsWith('/role')
        ),
        secondOwnerTargetCard.getByTestId('role-submit').click()
      ]).then(([response]) => response)
    ]);

    const statuses = [firstResponse.status(), secondResponse.status()].sort(
      (left, right) => left - right
    );

    expect(statuses[0]).toBe(200);
    expect([403, 409]).toContain(statuses[1] ?? 0);
    expect(await countOwners()).toBe(1);

    const firstPageErrorVisible = await page
      .getByTestId('role-form-error')
      .isVisible()
      .catch(() => false);
    const secondPageErrorVisible = await secondOwnerSession.page
      .getByTestId('role-form-error')
      .isVisible()
      .catch(() => false);

    expect(firstPageErrorVisible || secondPageErrorVisible).toBe(true);
    await secondOwnerSession.context.close();
  });
});
