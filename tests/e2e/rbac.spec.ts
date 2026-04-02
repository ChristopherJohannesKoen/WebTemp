import { expect, test } from '@playwright/test';
import { resetDatabase } from './support/e2e-db';
import { seededUsers, signIn, signOutFromSidebar } from './support/auth';

test.beforeEach(async () => {
  await resetDatabase('baseline');
});

test('lets the owner promote a member to admin and grants admin console access', async ({
  page
}) => {
  await signIn(page, seededUsers.owner);
  await page.goto('/app/admin/users');

  const memberCard = page.getByTestId(`admin-user-${seededUsers.member.email}`);
  await memberCard.getByTestId('role-select').selectOption('admin');
  await memberCard.getByTestId('role-submit').click();
  await expect(memberCard.getByTestId('role-select')).toHaveValue('admin');

  await signOutFromSidebar(page);
  await signIn(page, seededUsers.member);
  await page.goto('/app/admin/users');
  const promotedMemberCard = page.getByTestId(`admin-user-${seededUsers.member.email}`);
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  await expect(promotedMemberCard.getByText('Owners can change roles. Admins are read-only here.')).toBeVisible();
});
