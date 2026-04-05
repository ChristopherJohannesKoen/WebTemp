import { redirect } from 'next/navigation';
import { SignInForm } from '../../components/sign-in-form';
import { getCurrentUser, getSsoProviders } from '../../lib/server-api';

export default async function LoginPage() {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect('/app');
  }

  const ssoProviders = await getSsoProviders();

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-4xl space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Template auth</p>
          <p className="text-sm text-slate-600">
            {ssoProviders.providers.length > 0
              ? 'Enterprise SSO is the preferred access path. Local credentials remain available only when the environment policy explicitly allows them.'
              : 'Sign in with an existing account to open the protected dashboard.'}
          </p>
        </div>
        <SignInForm
          breakGlassEnabled={ssoProviders.breakGlassEnabled}
          localAuthEnabled={ssoProviders.localAuthEnabled}
          providers={ssoProviders.providers}
        />
      </div>
    </main>
  );
}
