'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ForgotPasswordResponse } from '@packages/shared';
import { Button, Card, Field, Input } from '@packages/ui';
import { requestPasswordReset } from '../lib/client-api';
import { describedByIds, toFieldErrorMap } from '../lib/form-errors';
import { toApiError } from '../lib/api-error';
import { FieldErrorMessage, FormErrorMessage } from './form-feedback';

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ForgotPasswordResponse>();

  async function requestResetLink(formData: FormData) {
    return requestPasswordReset({
      email: String(formData.get('email') ?? '')
    });
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    setFieldErrors({});

    try {
      const response = await requestResetLink(formData);

      setResult(response);
    } catch (caughtError) {
      const apiError = toApiError(caughtError);
      setError(apiError.message);
      setFieldErrors(toFieldErrorMap(apiError.errors));
    } finally {
      setPending(false);
    }
  }

  const emailError = fieldErrors.email;

  return (
    <Card className="mx-auto max-w-md bg-white/90">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Recovery flow</p>
        <h1 className="text-3xl font-black text-slate-950">Reset your password</h1>
        <p className="text-sm text-slate-600">
          When local reset-detail exposure is enabled, the API returns a usable reset link so you
          can test the full flow without email delivery.
        </p>
      </div>
      <form action={handleSubmit} className="mt-6 grid gap-4" data-testid="forgot-password-form">
        <Field label="Email">
          <>
            <Input
              aria-describedby={describedByIds(emailError && 'forgot-password-email-error')}
              aria-invalid={emailError ? 'true' : 'false'}
              autoComplete="email"
              data-testid="forgot-password-email"
              id="forgot-password-email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
            <FieldErrorMessage
              error={emailError}
              id="forgot-password-email-error"
              testId="forgot-password-email-error"
            />
          </>
        </Field>
        <FormErrorMessage
          error={error}
          messageTestId="forgot-password-error"
          regionTestId="forgot-password-error-region"
        />
        <Button data-testid="forgot-password-submit" disabled={pending} type="submit">
          {pending ? 'Generating link...' : 'Generate reset link'}
        </Button>
      </form>
      {result ? (
        <div
          className="mt-6 grid gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
          data-testid="forgot-password-result"
        >
          <p>{result.message}</p>
          {result.resetUrl ? (
            <Link className="font-semibold underline" href={result.resetUrl}>
              Open reset page
            </Link>
          ) : null}
          {result.resetToken ? (
            <p className="break-all text-xs text-emerald-700" data-testid="forgot-password-token">
              Token: {result.resetToken}
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="mt-6 text-sm text-slate-600">
        Back to{' '}
        <Link className="font-medium text-slate-950" href="/login">
          sign in
        </Link>
        .
      </p>
    </Card>
  );
}
