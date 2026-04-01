import Link from 'next/link';
import { buttonClassName } from '@packages/ui';
import type { SessionUser } from '@packages/shared';

export function SiteHeader({ currentUser }: { currentUser?: SessionUser }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-[rgba(244,241,234,0.92)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-black uppercase tracking-[0.3em] text-slate-950">
          Ultimate
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/app"
            className="text-sm font-medium text-slate-700 transition hover:text-slate-950"
          >
            Dashboard
          </Link>
          {currentUser ? (
            <Link className={buttonClassName({})} href="/app">
              {currentUser.name}
            </Link>
          ) : (
            <>
              <Link className={buttonClassName({ variant: 'ghost' })} href="/login">
                Sign in
              </Link>
              <Link className={buttonClassName({})} href="/signup">
                Start building
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
