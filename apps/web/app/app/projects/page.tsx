import Link from 'next/link';
import { Badge, Card, EmptyState, buttonClassName } from '@packages/ui';
import { formatDate, projectTone } from '../../../lib/display';
import { getProjects } from '../../../lib/server-api';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams;
  const search = getSingleValue(resolvedSearchParams.search) ?? '';
  const status = getSingleValue(resolvedSearchParams.status) ?? '';
  const includeArchived = getSingleValue(resolvedSearchParams.includeArchived) === 'true';
  const cursor = getSingleValue(resolvedSearchParams.cursor) ?? '';
  const trail = getSingleValue(resolvedSearchParams.trail) ?? '';
  const trailEntries = trail ? trail.split(',').filter(Boolean) : [];

  const queryParams = new URLSearchParams();
  if (search) queryParams.set('search', search);
  if (status) queryParams.set('status', status);
  if (includeArchived) queryParams.set('includeArchived', 'true');
  if (cursor) queryParams.set('cursor', cursor);
  queryParams.set('limit', '12');

  const filterParams = new URLSearchParams();
  if (search) filterParams.set('search', search);
  if (status) filterParams.set('status', status);
  if (includeArchived) filterParams.set('includeArchived', 'true');

  const projects = await getProjects(queryParams.toString());
  const nextTrailEntries = [...trailEntries, cursor || 'root'];
  const previousCursor = trailEntries.at(-1);
  const previousTrail = trailEntries.slice(0, -1);

  const previousParams = new URLSearchParams(filterParams);
  if (previousCursor && previousCursor !== 'root') {
    previousParams.set('cursor', previousCursor);
  }
  if (previousTrail.length > 0) {
    previousParams.set('trail', previousTrail.join(','));
  }

  const nextParams = new URLSearchParams(filterParams);
  if (projects.nextCursor) {
    nextParams.set('cursor', projects.nextCursor);
    nextParams.set('trail', nextTrailEntries.join(','));
  }

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Reference slice</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950">Projects</h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-600">
            This page is the template&apos;s reusable CRUD baseline: filters, cursor pagination,
            archiving, detail editing, and CSV export against the real API. Exports stream the full
            filtered result or fail explicitly when the synchronous limit is exceeded.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className={buttonClassName({ variant: 'secondary' })}
            data-testid="project-export-link"
            href={`/api/projects/export.csv?${filterParams.toString()}`}
          >
            Export CSV
          </Link>
          <Link className={buttonClassName({})} data-testid="project-new-link" href="/app/projects/new">
            New project
          </Link>
        </div>
      </section>

      <Card>
        <form className="grid gap-4 md:grid-cols-[1fr_180px_auto_auto] md:items-end">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-800">Search</span>
            <input
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950"
              defaultValue={search}
              name="search"
              placeholder="Search name or description"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-800">Status</span>
            <select
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
              defaultValue={status}
              name="status"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              className="size-4"
              defaultChecked={includeArchived}
              name="includeArchived"
              type="checkbox"
              value="true"
            />
            Include archived
          </label>
          <button className={buttonClassName({})} type="submit">
            Apply filters
          </button>
        </form>
      </Card>

      {projects.items.length === 0 ? (
        <EmptyState
          action={
            <Link className={buttonClassName({})} href="/app/projects/new">
              Create a project
            </Link>
          }
          description="No projects match the current filters. Reset them or create a new record."
          title="No matching projects"
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {projects.items.map((project) => (
            <Card
              data-project-name={project.name}
              data-testid="project-card"
              key={project.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={projectTone(project.status)}>{project.status}</Badge>
                    {project.isArchived ? <Badge tone="rose">archived</Badge> : null}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-950">{project.name}</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {project.description ?? 'No description provided yet.'}
                    </p>
                  </div>
                </div>
                <Link
                  className={buttonClassName({ variant: 'ghost' })}
                  href={`/app/projects/${project.id}`}
                >
                  Manage
                </Link>
              </div>
              <div className="mt-6 grid gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span>Owner: {project.creator.name}</span>
                <span>Updated: {formatDate(project.updatedAt)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <section className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-600">
          Showing {projects.items.length} projects{projects.hasMore ? ' with more available' : ''}.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            aria-disabled={trailEntries.length === 0}
            className={buttonClassName({
              variant: 'secondary',
              className: trailEntries.length === 0 ? 'pointer-events-none opacity-50' : undefined
            })}
            href={`/app/projects${previousParams.toString() ? `?${previousParams.toString()}` : ''}`}
          >
            Previous
          </Link>
          <Link
            aria-disabled={!projects.hasMore || !projects.nextCursor}
            className={buttonClassName({
              variant: 'secondary',
              className:
                !projects.hasMore || !projects.nextCursor
                  ? 'pointer-events-none opacity-50'
                  : undefined
            })}
            href={`/app/projects${nextParams.toString() ? `?${nextParams.toString()}` : ''}`}
          >
            Next
          </Link>
        </div>
      </section>
    </div>
  );
}
