import { notFound } from 'next/navigation';
import { Badge, Card } from '@packages/ui';
import { ProjectActions } from '../../../../components/project-actions';
import { ProjectForm } from '../../../../components/project-form';
import { formatDate, projectTone } from '../../../../lib/display';
import { getProject } from '../../../../lib/server-api';

type Params = Promise<{ id: string }>;

export default async function ProjectDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  try {
    const project = await getProject(id);

    return (
      <div className="grid gap-6">
        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={projectTone(project.status)}>{project.status}</Badge>
              {project.isArchived ? <Badge tone="rose">archived</Badge> : null}
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
              {project.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              {project.description ?? 'No description provided yet.'}
            </p>
            <div className="mt-6 grid gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
              <span>Created by {project.creator.name}</span>
              <span>Created {formatDate(project.createdAt)}</span>
              <span>Updated {formatDate(project.updatedAt)}</span>
            </div>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Project actions</p>
            <h2 className="mt-3 text-2xl font-black text-slate-950">Lifecycle</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Archive, restore, or delete the record to validate the rest of the reference flow.
            </p>
            <div className="mt-6">
              <ProjectActions project={project} />
            </div>
          </Card>
        </section>
        <Card>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Edit</p>
          <h2 className="mt-3 text-2xl font-black text-slate-950">Update project</h2>
          <div className="mt-6">
            <ProjectForm mode="edit" project={project} />
          </div>
        </Card>
      </div>
    );
  } catch {
    notFound();
  }
}
