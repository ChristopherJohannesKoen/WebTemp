import { redirect } from 'next/navigation';
import { SignInForm } from '../../components/sign-in-form';
import { getCurrentUser, getSsoProviders } from '../../lib/server-api';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect('/app');
  }

  const ssoProviders = await getSsoProviders();
  const resolvedSearchParams = await searchParams;
  const breakGlassMode =
    getSingleValue(resolvedSearchParams.mode) === 'break-glass' && ssoProviders.breakGlassEnabled;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-4xl space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Template auth</p>
          <p className="text-sm text-slate-600">
            {breakGlassMode
              ? 'Break-glass access is reserved for audited owner recovery. Use it only during an active incident or provider outage.'
              : ssoProviders.providers.length > 0
                ? 'Enterprise SSO is the primary access path. OIDC is preferred when configured, while local credentials remain limited to approved bootstrap or emergency scenarios.'
                : 'Sign in with an existing account to open the protected dashboard.'}
          </p>
        </div>
        <SignInForm
          breakGlassEnabled={ssoProviders.breakGlassEnabled}
          breakGlassMode={breakGlassMode}
          defaultProviderSlug={ssoProviders.defaultProviderSlug}
          localAuthEnabled={ssoProviders.localAuthEnabled}
          providers={ssoProviders.providers}
        />
      </div>
    </main>
  );
}
