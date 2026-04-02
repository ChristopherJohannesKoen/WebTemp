import Link from 'next/link';
import { Badge, Card, EmptyState, buttonClassName } from '@packages/ui';
import { formatDate, projectTone, roleTone } from '../../lib/display';
import { getProjects, requireCurrentUser } from '../../lib/server-api';

export default async function DashboardPage() {
  const currentUser = await requireCurrentUser();
  const projects = await getProjects('limit=4');

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-[32px] bg-slate-950 p-8 text-white">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={roleTone(currentUser.role)}>{currentUser.role}</Badge>
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Authenticated shell
          </span>
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-black tracking-tight">Welcome back, {currentUser.name}.</h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-300">
            This dashboard proves the template baseline: cookie auth, role-aware navigation, seeded
            data, and a reusable product slice that future projects can extend instead of
            rebuilding.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className={buttonClassName({ className: 'bg-white text-slate-950 hover:bg-slate-200' })}
            href="/app/projects"
          >
            Open projects
          </Link>
          <Link
            className={buttonClassName({
              variant: 'ghost',
              className: 'text-white hover:bg-white/10 hover:text-white'
            })}
            href="/app/settings"
          >
            Update profile
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Projects</p>
          <p className="mt-4 text-4xl font-black text-slate-950">
            {projects.items.length}
            {projects.hasMore ? '+' : ''}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Recent records loaded through the cursor-based reference workflow.
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Role</p>
          <p className="mt-4 text-4xl font-black text-slate-950">{currentUser.role}</p>
          <p className="mt-2 text-sm text-slate-600">
            Owner can reassign roles. Admin can review users.
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Template mode</p>
          <p className="mt-4 text-4xl font-black text-slate-950">Ready</p>
          <p className="mt-2 text-sm text-slate-600">
            The stack boots around one real feature, not empty placeholders.
          </p>
        </Card>
      </section>

      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Recent activity</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Latest projects</h2>
          </div>
          <Link className={buttonClassName({ variant: 'secondary' })} href="/app/projects/new">
            New project
          </Link>
        </div>
        {projects.items.length === 0 ? (
          <EmptyState
            action={
              <Link className={buttonClassName({})} href="/app/projects/new">
                Create the first project
              </Link>
            }
            description="Seed data is missing or the database is empty. Creating a project exercises the reference API and UI flow."
            title="No projects yet"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.items.map((project) => (
              <Card key={project.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-2">
                    <Badge tone={projectTone(project.status)}>{project.status}</Badge>
                    {project.isArchived ? <Badge tone="rose">archived</Badge> : null}
                    <h3 className="text-xl font-bold text-slate-950">{project.name}</h3>
                  </div>
                  <Link
                    className={buttonClassName({ variant: 'ghost' })}
                    href={`/app/projects/${project.id}`}
                  >
                    View
                  </Link>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  {project.description ?? 'No description provided yet.'}
                </p>
                <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">
                  Updated {formatDate(project.updatedAt)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
