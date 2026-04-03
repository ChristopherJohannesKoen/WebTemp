'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button, Card, buttonClassName } from '@packages/ui';

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="max-w-2xl" data-testid="protected-route-error">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Protected route error</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">The page could not be loaded.</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          The session is still active, but the upstream request failed. Retry the page or return to
          the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => reset()} type="button">
            Try again
          </Button>
          <Link className={buttonClassName({ variant: 'secondary' })} href="/app">
            Back to dashboard
          </Link>
        </div>
      </Card>
    </div>
  );
}
