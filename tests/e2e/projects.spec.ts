import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { addProjectsForPagination, resetDatabase } from './support/e2e-db';
import { seededUsers, signIn } from './support/auth';

test.beforeEach(async () => {
  await resetDatabase('baseline');
});

test('shows seeded projects and filter controls', async ({ page }) => {
  await signIn(page, seededUsers.owner);

  await page.goto('/app/projects');
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await expect(page.getByText('Launch marketing refresh')).toBeVisible();

  await page.getByLabel('Search').fill('marketing');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByText('Launch marketing refresh')).toBeVisible();
  await expect(page.getByText('Quarterly analytics review')).not.toBeVisible();

  await page.getByLabel('Search').fill('');
  await page.getByLabel('Status').selectOption('completed');
  await page.getByLabel('Include archived').check();
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByText('Migration playbook')).toBeVisible();
});

test('supports cursor pagination across a larger project set', async ({ page }) => {
  await addProjectsForPagination(16);
  await signIn(page, seededUsers.owner);

  await page.goto('/app/projects?view=pagination');
  await expect(page.getByRole('link', { name: 'Next' })).toHaveAttribute('aria-disabled', 'false');
  await expect(page.getByText('Pagination fixture 16')).toBeVisible();
  await page.getByRole('link', { name: 'Next' }).click();
  await expect(page).toHaveURL(/cursor=/);
  await expect(page.getByText('Pagination fixture 16')).not.toBeVisible();
  await page.getByRole('link', { name: 'Previous' }).click();
  await expect(page).toHaveURL(/\/app\/projects(?:\?.*)?$/);
  await expect(page.getByText('Pagination fixture 16')).toBeVisible();
});

test('lets the owner create, edit, archive, restore, and delete a project', async ({ page }) => {
  await signIn(page, seededUsers.owner);

  await page.goto('/app/projects/new');
  await page.getByTestId('project-name').fill('Owner managed project');
  await page.getByTestId('project-description').fill('Created by the owner flow.');
  await page.getByTestId('project-status').selectOption('paused');
  await page.getByTestId('project-submit').click();

  await expect(page).not.toHaveURL(/\/app\/projects\/new$/);
  await expect(page.getByRole('heading', { name: 'Owner managed project' })).toBeVisible();

  await page.getByTestId('project-name').fill('Owner managed project updated');
  await page.getByTestId('project-description').fill('Updated through the project detail form.');
  await page.getByTestId('project-status').selectOption('completed');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/projects/') &&
        response.request().method() === 'PATCH' &&
        response.status() === 200
    ),
    page.getByTestId('project-submit').click()
  ]);
  await expect(page.getByTestId('project-detail-name')).toHaveText('Owner managed project updated');
  await expect(page.getByTestId('project-detail-description')).toHaveText(
    'Updated through the project detail form.'
  );
  await expect(page.getByTestId('project-detail-status')).toHaveText('completed');

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/projects/') &&
        response.request().method() === 'PATCH' &&
        response.status() === 200
    ),
    page.getByTestId('project-archive-toggle').click()
  ]);
  await expect(page.getByTestId('project-detail-archived')).toBeVisible();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/projects/') &&
        response.request().method() === 'PATCH' &&
        response.status() === 200
    ),
    page.getByTestId('project-archive-toggle').click()
  ]);
  await expect(page.getByTestId('project-detail-archived')).not.toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/projects/') &&
        response.request().method() === 'DELETE' &&
        response.status() === 200
    ),
    page.getByTestId('project-delete').click()
  ]);
  await expect(page).toHaveURL(/\/app\/projects$/);
  await expect(page.getByText('Owner managed project updated')).not.toBeVisible();
});

test('exports filtered projects as CSV', async ({ page }) => {
  await signIn(page, seededUsers.owner);

  await page.goto('/app/projects');
  await page.getByLabel('Search').fill('Launch');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('project-export-link').click()
  ]);

  const downloadPath = await download.path();

  if (!downloadPath) {
    throw new Error('Playwright did not persist the CSV download.');
  }

  const fileContents = await readFile(downloadPath, 'utf8');

  expect(fileContents).toContain('Launch marketing refresh');
  expect(fileContents).not.toContain('Quarterly analytics review');
});

test('blocks a member from mutating an owner project but allows editing their own project', async ({
  page
}) => {
  await signIn(page, seededUsers.member);

  await page.goto('/app/projects');
  await page.getByTestId('project-new-link').click();
  await page.getByTestId('project-name').fill('Member owned project');
  await page.getByTestId('project-description').fill('Created by the member flow.');
  await page.getByTestId('project-submit').click();
  await expect(page).not.toHaveURL(/\/app\/projects\/new$/);
  await expect(page.getByRole('heading', { name: 'Member owned project' })).toBeVisible();

  await page.getByTestId('project-name').fill('Member owned project updated');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/projects/') &&
        response.request().method() === 'PATCH' &&
        response.status() === 200
    ),
    page.getByTestId('project-submit').click()
  ]);
  await expect(page.getByTestId('project-detail-name')).toHaveText('Member owned project updated');
  const memberProjectUrl = page.url();

  await page.goto('/app/projects');
  await page
    .locator('[data-testid="project-card"][data-project-name="Launch marketing refresh"]')
    .getByRole('link', { name: 'Manage' })
    .click();
  let forbiddenResponses = 0;
  page.on('response', (response) => {
    if (
      response.url().includes('/api/projects/') &&
      response.request().method() === 'PATCH' &&
      response.status() === 403
    ) {
      forbiddenResponses += 1;
    }
  });
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/projects/') &&
        response.request().method() === 'PATCH' &&
        response.status() === 403
    ),
    page.getByTestId('project-archive-toggle').click()
  ]);
  await expect(page.getByTestId('project-actions-error')).toContainText(
    'You do not have permission to modify this project.'
  );
  await page.waitForTimeout(250);
  expect(forbiddenResponses).toBe(1);

  await page.goto(memberProjectUrl);
  page.once('dialog', (dialog) => dialog.accept());
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/projects/') &&
        response.request().method() === 'DELETE' &&
        response.status() === 200
    ),
    page.getByTestId('project-delete').click()
  ]);
  await expect(page).toHaveURL(/\/app\/projects$/);
  await page.goto('/app/projects?search=Member%20owned%20project%20updated');
  await expect(page.getByRole('heading', { name: 'No matching projects' })).toBeVisible();
});

test('renders the protected-route error boundary for upstream project failures', async ({ page }) => {
  await signIn(page, seededUsers.owner);
  await page.goto('/app/projects');

  const projectPath = await page
    .locator('[data-testid="project-card"][data-project-name="Launch marketing refresh"]')
    .getByRole('link', { name: 'Manage' })
    .getAttribute('href');

  if (!projectPath) {
    throw new Error('Could not resolve the seeded project detail URL.');
  }

  await page.goto(`${projectPath}?forceError=upstream`);

  await expect(page.getByTestId('protected-route-error')).toBeVisible();
  await expect(page.getByTestId('protected-route-not-found')).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login$/);
});
