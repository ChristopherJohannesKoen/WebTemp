'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, Field, Input } from '@packages/ui';
import { clientApiRequest, clientSchemas } from '../lib/client-api';
import { describedByIds, toFieldErrorMap } from '../lib/form-errors';
import { toApiError } from '../lib/api-error';
import { FieldErrorMessage, FormErrorMessage } from './form-feedback';

export function SignUpForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    setFieldErrors({});

    try {
      await clientApiRequest('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
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

  const nameError = fieldErrors.name;
  const emailError = fieldErrors.email;
  const passwordError = fieldErrors.password;

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
      <form action={handleSubmit} className="mt-6 grid gap-4" data-testid="sign-up-form">
        <Field label="Full name">
          <>
            <Input
              aria-describedby={describedByIds(nameError && 'sign-up-name-error')}
              aria-invalid={nameError ? 'true' : 'false'}
              autoComplete="name"
              data-testid="sign-up-name"
              id="sign-up-name"
              name="name"
              placeholder="Avery Parker"
              required
            />
            <FieldErrorMessage
              error={nameError}
              id="sign-up-name-error"
              testId="sign-up-name-error"
            />
          </>
        </Field>
        <Field label="Email">
          <>
            <Input
              aria-describedby={describedByIds(emailError && 'sign-up-email-error')}
              aria-invalid={emailError ? 'true' : 'false'}
              autoComplete="email"
              data-testid="sign-up-email"
              id="sign-up-email"
              name="email"
              placeholder="avery@example.com"
              required
              type="email"
            />
            <FieldErrorMessage
              error={emailError}
              id="sign-up-email-error"
              testId="sign-up-email-error"
            />
          </>
        </Field>
        <Field hint="At least 8 characters" label="Password">
          <>
            <Input
              aria-describedby={describedByIds(passwordError && 'sign-up-password-error')}
              aria-invalid={passwordError ? 'true' : 'false'}
              autoComplete="new-password"
              data-testid="sign-up-password"
              id="sign-up-password"
              minLength={8}
              name="password"
              placeholder="Choose a strong password"
              required
              type="password"
            />
            <FieldErrorMessage
              error={passwordError}
              id="sign-up-password-error"
              testId="sign-up-password-error"
            />
          </>
        </Field>
        <FormErrorMessage
          error={error}
          messageTestId="sign-up-error"
          regionTestId="sign-up-error-region"
        />
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
