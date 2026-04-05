import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { getSeedUser } from './e2e-db';

type Credentials = {
  email: string;
  password: string;
};

type SignupPayload = Credentials & {
  name: string;
};

export const seededUsers = {
  owner: getSeedUser('owner'),
  admin: getSeedUser('admin'),
  member: getSeedUser('member')
};

export async function signIn(page: Page, credentials: Credentials) {
  await page.goto('/login');
  await page.getByTestId('sign-in-email').fill(credentials.email);
  await page.getByTestId('sign-in-password').fill(credentials.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).toHaveURL(/\/app$/);
}

export async function signUp(page: Page, payload: SignupPayload) {
  await page.goto('/signup');
  await page.getByTestId('sign-up-name').fill(payload.name);
  await page.getByTestId('sign-up-email').fill(payload.email);
  await page.getByTestId('sign-up-password').fill(payload.password);
  await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().includes('/api/auth/signup') && candidate.request().method() === 'POST'
    ),
    page.getByTestId('sign-up-submit').click()
  ]);
  await expect(page).toHaveURL(/\/app$/);
}

export async function signOutFromSidebar(page: Page) {
  await page.goto('/app/settings');
  await page.getByTestId('current-session-sign-out').click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function openSecondarySession(
  browser: Browser,
  credentials: Credentials
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await signIn(page, credentials);

  return { context, page };
}
