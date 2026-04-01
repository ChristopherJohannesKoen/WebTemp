import Link from 'next/link';
import { Badge, Card, EmptyState, buttonClassName } from '@packages/ui';
import { formatDate, projectTone } from '../../../lib/display';
import { getProjects } from '../../../lib/server-api';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();
  const search = getSingleValue(resolvedSearchParams.search) ?? '';
  const status = getSingleValue(resolvedSearchParams.status) ?? '';
  const includeArchived = getSingleValue(resolvedSearchParams.includeArchived) === 'true';
  const page = getSingleValue(resolvedSearchParams.page) ?? '1';

  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (includeArchived) params.set('includeArchived', 'true');
  params.set('page', page);
  params.set('pageSize', '12');

  const projects = await getProjects(params.toString());
  const currentPage = Number(page) || 1;
  const totalPages = Math.max(1, Math.ceil(projects.total / projects.pageSize));

  const previousParams = new URLSearchParams(params);
  previousParams.set('page', String(Math.max(1, currentPage - 1)));
  previousParams.delete('pageSize');

  const nextParams = new URLSearchParams(params);
  nextParams.set('page', String(Math.min(totalPages, currentPage + 1)));
  nextParams.delete('pageSize');

  const exportParams = new URLSearchParams(params);
  exportParams.delete('page');
  exportParams.delete('pageSize');

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Reference slice</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950">Projects</h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-600">
            This page is the template’s reusable CRUD baseline: filters, pagination, archiving,
            detail editing, and CSV export against the real API.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className={buttonClassName({ variant: 'secondary' })}
            href={`/api/projects/export.csv?${exportParams.toString()}`}
          >
            Export CSV
          </Link>
          <Link className={buttonClassName({})} href="/app/projects/new">
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
            <Card key={project.id}>
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
          Page {projects.page} of {totalPages} · {projects.total} total projects
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            aria-disabled={currentPage <= 1}
            className={buttonClassName({
              variant: 'secondary',
              className: currentPage <= 1 ? 'pointer-events-none opacity-50' : undefined
            })}
            href={`/app/projects?${previousParams.toString()}`}
          >
            Previous
          </Link>
          <Link
            aria-disabled={currentPage >= totalPages}
            className={buttonClassName({
              variant: 'secondary',
              className: currentPage >= totalPages ? 'pointer-events-none opacity-50' : undefined
            })}
            href={`/app/projects?${nextParams.toString()}`}
          >
            Next
          </Link>
        </div>
      </section>
    </div>
  );
}
