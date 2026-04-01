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
            Seeded owner email:{' '}
            <span className="font-semibold text-slate-950">{process.env.SEED_OWNER_EMAIL}</span>
          </p>
        </div>
        <SignInForm />
      </div>
    </main>
  );
}
