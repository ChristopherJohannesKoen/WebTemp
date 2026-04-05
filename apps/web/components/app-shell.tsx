import Link from 'next/link';
import { Badge } from '@packages/ui';
import type { SessionUser } from '@packages/shared';
import { canSeeAdminNav } from '../lib/authorization';
import { LogoutButton } from './logout-button';

export function AppShell({
  children,
  currentUser
}: {
  children: React.ReactNode;
  currentUser: SessionUser;
}) {
  const navigationItems = [
    { href: '/app', label: 'Overview' },
    { href: '/app/projects', label: 'Projects' },
    { href: '/app/settings', label: 'Settings' },
    ...(canSeeAdminNav(currentUser.role) ? [{ href: '/app/admin/users', label: 'Admin' }] : [])
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-[32px] border border-white/10 bg-white/5 p-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Template App</p>
            <h1 className="text-2xl font-black">Ultimate</h1>
            <Badge
              tone={
                currentUser.role === 'owner'
                  ? 'amber'
                  : currentUser.role === 'admin'
                    ? 'emerald'
                    : 'slate'
              }
            >
              {currentUser.role}
            </Badge>
          </div>
          <nav className="mt-8 grid gap-2 text-sm">
            {navigationItems.map((item) => (
              <Link
                className="rounded-2xl px-4 py-3 transition hover:bg-white/10"
                data-testid={`sidebar-nav-${item.label.toLowerCase()}`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8">
            <Link href="/" className="mb-3 block text-xs uppercase tracking-[0.3em] text-slate-500">
              Public site
            </Link>
            <LogoutButton />
          </div>
        </aside>
        <main className="rounded-[32px] border border-white/10 bg-white p-6 text-slate-950 shadow-card">
          {children}
        </main>
      </div>
    </div>
  );
}
