'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, Field, Input } from '@packages/ui';
import { clientApiRequest, clientSchemas } from '../lib/client-api';
import { describedByIds, toFieldErrorMap } from '../lib/form-errors';
import { toApiError } from '../lib/api-error';
import { FieldErrorMessage, FormErrorMessage } from './form-feedback';

export function ResetPasswordForm({ initialToken }: { initialToken?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    setFieldErrors({});

    try {
      await clientApiRequest('/api/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({
          token: formData.get('token'),
          password: formData.get('password')
        })
      }, {
        idempotent: true,
        schema: clientSchemas.auth
      });

      router.push('/app');
    } catch (caughtError) {
      const apiError = toApiError(caughtError);
      setError(apiError.message);
      setFieldErrors(toFieldErrorMap(apiError.errors));
    } finally {
      setPending(false);
    }
  }

  const tokenError = fieldErrors.token;
  const passwordError = fieldErrors.password;

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
      <form action={handleSubmit} className="mt-6 grid gap-4" data-testid="reset-password-form">
        <Field label="Reset token">
          <>
            <Input
              aria-describedby={describedByIds(tokenError && 'reset-password-token-error')}
              aria-invalid={tokenError ? 'true' : 'false'}
              data-testid="reset-password-token"
              defaultValue={initialToken}
              id="reset-password-token"
              name="token"
              placeholder="Paste reset token"
              required
            />
            <FieldErrorMessage
              error={tokenError}
              id="reset-password-token-error"
              testId="reset-password-token-error"
            />
          </>
        </Field>
        <Field hint="At least 8 characters" label="New password">
          <>
            <Input
              aria-describedby={describedByIds(passwordError && 'reset-password-password-error')}
              aria-invalid={passwordError ? 'true' : 'false'}
              autoComplete="new-password"
              data-testid="reset-password-new-password"
              id="reset-password-password"
              minLength={8}
              name="password"
              placeholder="Create a new password"
              required
              type="password"
            />
            <FieldErrorMessage
              error={passwordError}
              id="reset-password-password-error"
              testId="reset-password-password-error"
            />
          </>
        </Field>
        <FormErrorMessage
          error={error}
          messageTestId="reset-password-error"
          regionTestId="reset-password-error-region"
        />
        <Button data-testid="reset-password-submit" disabled={pending} type="submit">
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
