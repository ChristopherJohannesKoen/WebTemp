import { redirect } from 'next/navigation';
import { SignUpForm } from '../../components/sign-up-form';
import { getCurrentUser, getSsoProviders } from '../../lib/server-api';

export default async function SignupPage() {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect('/app');
  }

  const ssoProviders = await getSsoProviders();

  if (!ssoProviders.localAuthEnabled) {
    redirect('/login');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-4xl space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Template onboarding</p>
          <p className="text-sm text-slate-600">
            Use this route to validate self-serve member signup against the hardened auth baseline.
          </p>
        </div>
        <SignUpForm />
      </div>
    </main>
  );
}
