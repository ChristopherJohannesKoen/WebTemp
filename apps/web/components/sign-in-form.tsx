'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AuthResponse } from '@packages/shared';
import { Button, Card, Field, Input } from '@packages/ui';
import { toApiError } from '../lib/api-error';
import { clientApiRequest } from '../lib/client-api';

export function SignInForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);

    try {
      await clientApiRequest<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: formData.get('email'),
          password: formData.get('password')
        })
      });

      router.push('/app');
      router.refresh();
    } catch (caughtError) {
      setError(toApiError(caughtError).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md bg-white/90">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Access your app</p>
        <h1 className="text-3xl font-black text-slate-950">Sign in</h1>
        <p className="text-sm text-slate-600">
          Use the seeded owner account or sign in with an existing member account.
        </p>
      </div>
      <form action={handleSubmit} className="mt-6 grid gap-4">
        <Field hint="Example: owner@example.com" label="Email">
          <Input
            autoComplete="email"
            data-testid="sign-in-email"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
        </Field>
        <Field label="Password">
          <Input
            autoComplete="current-password"
            data-testid="sign-in-password"
            minLength={8}
            name="password"
            placeholder="At least 8 characters"
            required
            type="password"
          />
        </Field>
        {error ? <p className="text-sm text-rose-600" data-testid="sign-in-error">{error}</p> : null}
        <Button data-testid="sign-in-submit" disabled={pending} type="submit">
          {pending ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
      <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
        <Link className="font-medium text-slate-950" href="/forgot-password">
          Forgot your password?
        </Link>
        <Link className="font-medium text-slate-950" href="/signup">
          Create account
        </Link>
      </div>
    </Card>
  );
}
