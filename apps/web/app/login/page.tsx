import { redirect } from 'next/navigation';
import { SignInForm } from '../../components/sign-in-form';
import { getCurrentUser } from '../../lib/server-api';

export default async function LoginPage() {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect('/app');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-4xl space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Template auth</p>
          <p className="text-sm text-slate-600">
            Sign in with an existing account to open the protected dashboard.
          </p>
        </div>
        <SignInForm />
      </div>
    </main>
  );
}
