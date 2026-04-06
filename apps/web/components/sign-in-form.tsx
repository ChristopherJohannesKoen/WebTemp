'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { IdentityProviderSummary } from '@packages/shared';
import { Button, Card, Field, Input, buttonClassName } from '@packages/ui';
import { breakGlassSignIn, signIn } from '../lib/client-api';
import { describedByIds, toFieldErrorMap } from '../lib/form-errors';
import { toApiError } from '../lib/api-error';
import { FieldErrorMessage, FormErrorMessage } from './form-feedback';

type SignInFormProps = {
  providers: IdentityProviderSummary[];
  defaultProviderSlug: string | null;
  localAuthEnabled: boolean;
  breakGlassEnabled: boolean;
  breakGlassMode?: boolean;
};

export function SignInForm({
  providers,
  defaultProviderSlug,
  localAuthEnabled,
  breakGlassEnabled,
  breakGlassMode = false
}: SignInFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const primaryProvider =
    providers.find((provider) => provider.slug === defaultProviderSlug) ?? providers[0];
  const secondaryProviders = providers.filter(
    (provider) => provider.slug !== primaryProvider?.slug
  );
  const breakGlassOnly = breakGlassMode;
  const showLocalForm = localAuthEnabled || breakGlassMode;

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    setFieldErrors({});

    try {
      const credentials = {
        email: String(formData.get('email') ?? ''),
        password: String(formData.get('password') ?? '')
      };
      const action = breakGlassOnly ? breakGlassSignIn : signIn;

      await action(credentials);

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
        <h1 className="text-3xl font-black text-slate-950">
          {breakGlassMode
            ? 'Break-glass sign in'
            : providers.length > 0
              ? 'Enterprise sign in'
              : 'Sign in'}
        </h1>
        <p className="text-sm text-slate-600">
          {breakGlassMode
            ? 'Emergency owner access is audited and should only be used through the documented incident procedure.'
            : providers.length > 0
              ? 'Use your enterprise identity provider first. Local credentials stay available only when the environment policy allows them.'
              : 'Sign in with an existing account.'}
        </p>
      </div>
      {primaryProvider && !breakGlassMode ? (
        <div className="mt-6 grid gap-3">
          <a
            className={buttonClassName({})}
            data-testid={`sso-provider-${primaryProvider.slug}`}
            href={`/api/auth/sso/${primaryProvider.slug}/start?redirectTo=%2Fapp`}
          >
            Continue with {primaryProvider.displayName}
          </a>
          {secondaryProviders.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Other enterprise providers
              </p>
              {secondaryProviders.map((provider) => (
                <a
                  className={buttonClassName({ variant: 'secondary' })}
                  data-testid={`sso-provider-${provider.slug}`}
                  href={`/api/auth/sso/${provider.slug}/start?redirectTo=%2Fapp`}
                  key={provider.slug}
                >
                  Continue with {provider.displayName}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {showLocalForm ? (
        <form action={handleSubmit} className="mt-6 grid gap-4" data-testid="sign-in-form">
          {providers.length > 0 && !breakGlassMode ? (
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Local access</p>
          ) : null}
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
            {pending
              ? breakGlassOnly
                ? 'Authorizing...'
                : 'Signing in...'
              : breakGlassOnly
                ? 'Break-glass sign in'
                : 'Sign in'}
          </Button>
        </form>
      ) : (
        <div className="mt-6 grid gap-3">
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Local password sign-in is disabled for this environment.
          </p>
          {breakGlassEnabled ? (
            <p
              className="text-xs uppercase tracking-[0.2em] text-amber-700"
              data-testid="break-glass-guidance"
            >
              Emergency owner access remains available only through the documented break-glass
              procedure.
            </p>
          ) : null}
        </div>
      )}
      {localAuthEnabled ? (
        <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
          <Link className="font-medium text-slate-950" href="/forgot-password">
            Forgot your password?
          </Link>
          <Link className="font-medium text-slate-950" href="/signup">
            Create account
          </Link>
        </div>
      ) : null}
      {breakGlassOnly ? (
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-amber-700">
          Break-glass mode is audited and intended for owner-only emergency access.
        </p>
      ) : null}
    </Card>
  );
}
