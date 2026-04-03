'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AuthResponse } from '@packages/shared';
import { Button, Card, Field, Input } from '@packages/ui';
import { toApiError } from '../lib/api-error';
import { clientApiRequest } from '../lib/client-api';

export function SignUpForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);

    try {
      await clientApiRequest<AuthResponse>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          password: formData.get('password')
        })
      }, { idempotent: true });

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
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Create an account</p>
        <h1 className="text-3xl font-black text-slate-950">Sign up</h1>
        <p className="text-sm text-slate-600">
          Self-serve signup creates member accounts. Privileged roles are assigned intentionally
          through setup or the admin console.
        </p>
      </div>
      <form action={handleSubmit} className="mt-6 grid gap-4">
        <Field label="Full name">
          <Input
            autoComplete="name"
            data-testid="sign-up-name"
            name="name"
            placeholder="Avery Parker"
            required
          />
        </Field>
        <Field label="Email">
          <Input
            autoComplete="email"
            data-testid="sign-up-email"
            name="email"
            placeholder="avery@example.com"
            required
            type="email"
          />
        </Field>
        <Field hint="At least 8 characters" label="Password">
          <Input
            autoComplete="new-password"
            data-testid="sign-up-password"
            minLength={8}
            name="password"
            placeholder="Choose a strong password"
            required
            type="password"
          />
        </Field>
        {error ? <p className="text-sm text-rose-600" data-testid="sign-up-error">{error}</p> : null}
        <Button data-testid="sign-up-submit" disabled={pending} type="submit">
          {pending ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
      <p className="mt-6 text-sm text-slate-600">
        Already have an account?{' '}
        <Link className="font-medium text-slate-950" href="/login">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
