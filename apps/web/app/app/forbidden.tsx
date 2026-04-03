import Link from 'next/link';
import { Card, buttonClassName } from '@packages/ui';

export default function ForbiddenPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="max-w-2xl" data-testid="protected-route-forbidden">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Access denied</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">
          You do not have access to this page.
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Your account is authenticated, but it does not have permission to load this route.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className={buttonClassName({})} href="/app">
            Back to dashboard
          </Link>
          <Link className={buttonClassName({ variant: 'secondary' })} href="/app/settings">
            Open settings
          </Link>
        </div>
      </Card>
    </div>
  );
}
