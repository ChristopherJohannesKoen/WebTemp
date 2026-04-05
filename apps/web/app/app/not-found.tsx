import Link from 'next/link';
import { Card, buttonClassName } from '@packages/ui';

export default function AppNotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="max-w-2xl" data-testid="protected-route-not-found">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Missing resource</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">This record could not be found.</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          The requested resource no longer exists or the URL is incorrect.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className={buttonClassName({})} href="/app/projects">
            Back to projects
          </Link>
          <Link className={buttonClassName({ variant: 'secondary' })} href="/app">
            Dashboard
          </Link>
        </div>
      </Card>
    </div>
  );
}
