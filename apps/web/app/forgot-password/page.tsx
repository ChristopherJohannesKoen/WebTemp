import { redirect } from 'next/navigation';
import { ForgotPasswordForm } from '../../components/forgot-password-form';
import { getSsoProviders } from '../../lib/server-api';

export default async function ForgotPasswordPage() {
  const ssoProviders = await getSsoProviders();

  if (!ssoProviders.localAuthEnabled) {
    redirect('/login');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <ForgotPasswordForm />
    </main>
  );
}
