import Link from 'next/link';
import { Badge, Card, buttonClassName } from '@packages/ui';
import { SiteHeader } from '../components/site-header';
import { getCurrentUser } from '../lib/server-api';

const featureCards = [
  {
    title: 'Session auth + RBAC',
    description: 'Email/password auth, secure cookies, owner/admin/member roles, and audit logs.'
  },
  {
    title: 'Projects reference slice',
    description:
      'A complete CRUD workflow with search, filters, pagination, archive, delete, and CSV export.'
  },
  {
    title: 'Docker-first local setup',
    description:
      'Run Postgres locally, start the app stack fast, and keep deployment paths predictable.'
  }
];

export default async function Page() {
  const currentUser = await getCurrentUser();

  return (
    <div className="min-h-screen">
      <SiteHeader currentUser={currentUser} />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div className="space-y-8">
            <Badge tone="amber">Ultimate Website Template</Badge>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-black tracking-tight text-slate-950 md:text-7xl">
                Start with the boring hard parts already done.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-700">
                This template ships with auth, RBAC, Docker, Prisma, Swagger, tests, CI, and a
                polished dashboard reference flow so new projects start at domain logic, not
                infrastructure drag.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className={buttonClassName({})} href={currentUser ? '/app' : '/signup'}>
                {currentUser ? 'Open Dashboard' : 'Create Your First App'}
              </Link>
              <Link className={buttonClassName({ variant: 'secondary' })} href="/login">
                Explore Auth Flow
              </Link>
            </div>
          </div>
          <Card className="bg-slate-950 text-white">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Stack</p>
            <div className="mt-4 grid gap-3 text-sm text-slate-200">
              <div>Next.js 15.5 + React 19</div>
              <div>NestJS 11 + Prisma + PostgreSQL</div>
              <div>Session cookies + audit logging</div>
              <div>Tailwind + shared UI package</div>
            </div>
          </Card>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-3">
          {featureCards.map((feature) => (
            <Card key={feature.title}>
              <h2 className="text-xl font-bold text-slate-950">{feature.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{feature.description}</p>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
