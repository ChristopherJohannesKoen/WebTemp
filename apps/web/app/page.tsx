export default async function Page() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

  return (
    <main style={{ minHeight: '100vh', padding: '2rem', background: '#0b0b0b', color: '#f7f7f7' }}>
      <h1>Ultimate General Website Template</h1>
      <p>Frontend: Next.js standalone + Turborepo</p>
      <p>API Base URL: {apiBaseUrl}</p>
      <p>Visit <code>{apiBaseUrl}/api/health</code> after starting the API.</p>
    </main>
  );
}
