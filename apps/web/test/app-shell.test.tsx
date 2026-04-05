import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../components/app-shell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  })
}));

afterEach(() => {
  cleanup();
});

describe('AppShell', () => {
  it('hides the admin navigation link for members', () => {
    render(
      <AppShell
        currentUser={{
          id: 'user_member',
          email: 'member@example.com',
          name: 'Template Member',
          role: 'member'
        }}
      >
        <div>Dashboard</div>
      </AppShell>
    );

    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
  });

  it('shows the admin navigation link for admins', () => {
    render(
      <AppShell
        currentUser={{
          id: 'user_admin',
          email: 'admin@example.com',
          name: 'Template Admin',
          role: 'admin'
        }}
      >
        <div>Dashboard</div>
      </AppShell>
    );

    expect(screen.getByRole('link', { name: 'Admin' })).toBeTruthy();
  });

  it(
    'passes automated axe checks for the dashboard shell',
    async () => {
      const { container } = render(
        <AppShell
          currentUser={{
            id: 'user_owner',
            email: 'owner@example.com',
            name: 'Template Owner',
            role: 'owner'
          }}
        >
          <div>Dashboard</div>
        </AppShell>
      );

      const results = await axe.run(container, {
        rules: {
          'color-contrast': { enabled: false }
        }
      });

      expect(results.violations).toHaveLength(0);
    },
    15000
  );
});
