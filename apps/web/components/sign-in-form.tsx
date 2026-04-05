'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, Field, Input } from '@packages/ui';
import { clientApiRequest, clientSchemas } from '../lib/client-api';
import { describedByIds, toFieldErrorMap } from '../lib/form-errors';
import { toApiError } from '../lib/api-error';
import { FieldErrorMessage, FormErrorMessage } from './form-feedback';

export function SignInForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    setFieldErrors({});

    try {
      await clientApiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: formData.get('email'),
          password: formData.get('password')
        })
      }, {
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

  const emailError = fieldErrors.email;
  const passwordError = fieldErrors.password;

  return (
    <Card className="mx-auto max-w-md bg-white/90">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Access your app</p>
        <h1 className="text-3xl font-black text-slate-950">Sign in</h1>
        <p className="text-sm text-slate-600">Sign in with an existing account.</p>
      </div>
      <form action={handleSubmit} className="mt-6 grid gap-4" data-testid="sign-in-form">
        <Field hint="Example: you@example.com" label="Email">
          <>
            <Input
              aria-describedby={describedByIds(emailError && 'sign-in-email-error')}
              aria-invalid={emailError ? 'true' : 'false'}
              autoComplete="email"
              data-testid="sign-in-email"
              id="sign-in-email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
            <FieldErrorMessage
              error={emailError}
              id="sign-in-email-error"
              testId="sign-in-email-error"
            />
          </>
        </Field>
        <Field label="Password">
          <>
            <Input
              aria-describedby={describedByIds(passwordError && 'sign-in-password-error')}
              aria-invalid={passwordError ? 'true' : 'false'}
              autoComplete="current-password"
              data-testid="sign-in-password"
              id="sign-in-password"
              minLength={8}
              name="password"
              placeholder="At least 8 characters"
              required
              type="password"
            />
            <FieldErrorMessage
              error={passwordError}
              id="sign-in-password-error"
              testId="sign-in-password-error"
            />
          </>
        </Field>
        <FormErrorMessage
          error={error}
          messageTestId="sign-in-error"
          regionTestId="sign-in-error-region"
        />
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
