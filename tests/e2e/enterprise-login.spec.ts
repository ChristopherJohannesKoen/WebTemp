import { expect, test } from '@playwright/test';

test.describe('enterprise login posture', () => {
  test.skip(
    process.env.E2E_PROFILE !== 'enterprise',
    'Enterprise login posture runs only under the enterprise E2E profile.'
  );

  test('shows the default OIDC provider first and suppresses normal local auth', async ({
    page
  }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Enterprise sign in' })).toBeVisible();
    await expect(page.getByTestId('sso-provider-enterprise-oidc')).toBeVisible();
    await expect(page.getByTestId('sso-provider-enterprise-oidc')).toHaveText(
      'Continue with Corporate SSO'
    );
    await expect(page.getByTestId('sign-in-form')).toHaveCount(0);
    await expect(page.getByTestId('break-glass-guidance')).toContainText(
      'Emergency owner access remains available only through the documented break-glass procedure.'
    );
  });

  test('renders break-glass mode only when explicitly requested', async ({ page }) => {
    await page.goto('/login?mode=break-glass');

    await expect(page.getByRole('heading', { name: 'Break-glass sign in' })).toBeVisible();
    await expect(page.getByTestId('sign-in-form')).toBeVisible();
    await expect(page.getByTestId('sign-in-submit')).toHaveText('Break-glass sign in');
    await expect(page.getByTestId('sso-provider-enterprise-oidc')).toHaveCount(0);
  });
});
