import { expect, test } from '@playwright/test';
import { resetDatabase } from './support/e2e-db';
import { seededUsers, signIn, signOutFromSidebar } from './support/auth';

test.beforeEach(async () => {
  await resetDatabase('baseline');
});

test('renders the public landing page and auth links', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Start with the boring hard parts already done.' })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create Your First App' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore Auth Flow' })).toBeVisible();
});

test('redirects unauthenticated users from protected routes', async ({ page }) => {
  for (const path of ['/app', '/app/projects', '/app/settings']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test('redirects authenticated users away from login and signup', async ({ page }) => {
  await signIn(page, seededUsers.owner);

  await page.goto('/login');
  await expect(page).toHaveURL(/\/app$/);

  await page.goto('/signup');
  await expect(page).toHaveURL(/\/app$/);
});

test('signs in the seeded owner, updates the profile, and logs out', async ({ page }) => {
  await signIn(page, seededUsers.owner);
  await expect(page.getByRole('heading', { name: /Welcome back, Template Owner\./ })).toBeVisible();

  await page.goto('/app/settings');
  await page.getByTestId('profile-name').fill('Template Owner Updated');
  await page.getByTestId('profile-save').click();
  await expect(page.getByTestId('profile-name')).toHaveValue('Template Owner Updated');

  await signOutFromSidebar(page);
});

test('shows an error for invalid login credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('sign-in-email').fill(seededUsers.owner.email);
  await page.getByTestId('sign-in-password').fill('WrongPassword123!');
  await page.getByTestId('sign-in-submit').click();

  await expect(page.getByTestId('sign-in-error')).toContainText('Invalid email or password.');
});

test('completes the forgot and reset password flow end to end', async ({ page }) => {
  const newPassword = 'ChangedPass123!';

  await page.goto('/forgot-password');
  await page.getByTestId('forgot-password-email').fill(seededUsers.owner.email);
  await page.getByTestId('forgot-password-submit').click();

  await expect(page.getByTestId('forgot-password-result')).toContainText(
    'If the account exists, a password reset link has been generated for this environment.'
  );

  const tokenText = await page.getByTestId('forgot-password-token').textContent();
  const token = tokenText?.replace('Token: ', '').trim();

  if (!token) {
    throw new Error('Password reset token was not rendered.');
  }

  await page.goto(`/reset-password?token=${token}`);
  await page.getByTestId('reset-password-new-password').fill(newPassword);
  await page.getByTestId('reset-password-submit').click();
  await expect(page).toHaveURL(/\/app$/);

  await signOutFromSidebar(page);

  await page.goto('/login');
  await page.getByTestId('sign-in-email').fill(seededUsers.owner.email);
  await page.getByTestId('sign-in-password').fill(seededUsers.owner.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page.getByTestId('sign-in-error')).toContainText('Invalid email or password.');

  await page.getByTestId('sign-in-email').fill(seededUsers.owner.email);
  await page.getByTestId('sign-in-password').fill(newPassword);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).toHaveURL(/\/app$/);
});
