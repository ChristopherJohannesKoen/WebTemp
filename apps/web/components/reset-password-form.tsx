'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AuthResponse } from '@packages/shared';
import { Button, Card, Field, Input } from '@packages/ui';
import { toApiError } from '../lib/api-error';
import { clientApiRequest } from '../lib/client-api';

export function ResetPasswordForm({ initialToken }: { initialToken?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);

    try {
      await clientApiRequest<AuthResponse>('/api/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({
          token: formData.get('token'),
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
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Complete recovery</p>
        <h1 className="text-3xl font-black text-slate-950">Choose a new password</h1>
        <p className="text-sm text-slate-600">
          Paste the token from the forgot-password response or open this page through the generated
          link.
        </p>
      </div>
      <form action={handleSubmit} className="mt-6 grid gap-4">
        <Field label="Reset token">
          <Input
            defaultValue={initialToken}
            name="token"
            placeholder="Paste reset token"
            required
          />
        </Field>
        <Field hint="At least 8 characters" label="New password">
          <Input
            autoComplete="new-password"
            minLength={8}
            name="password"
            placeholder="Create a new password"
            required
            type="password"
          />
        </Field>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <Button disabled={pending} type="submit">
          {pending ? 'Updating password...' : 'Reset password'}
        </Button>
      </form>
      <p className="mt-6 text-sm text-slate-600">
        Return to{' '}
        <Link className="font-medium text-slate-950" href="/login">
          sign in
        </Link>
        .
      </p>
    </Card>
  );
}
