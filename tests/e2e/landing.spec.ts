import { expect, test } from '@playwright/test';

test('renders the public landing page', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Start with the boring hard parts already done.' })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create Your First App' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore Auth Flow' })).toBeVisible();
});
