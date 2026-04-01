import { ResetPasswordForm } from '../../components/reset-password-form';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams;
  const token = Array.isArray(resolvedSearchParams.token)
    ? resolvedSearchParams.token[0]
    : resolvedSearchParams.token;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <ResetPasswordForm initialToken={token} />
    </main>
  );
}
