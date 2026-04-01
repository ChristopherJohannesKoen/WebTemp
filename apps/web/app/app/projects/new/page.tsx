import { Card } from '@packages/ui';
import { ProjectForm } from '../../../../components/project-form';

export default function NewProjectPage() {
  return (
    <div className="grid gap-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Create</p>
        <h1 className="text-4xl font-black tracking-tight text-slate-950">New project</h1>
        <p className="max-w-2xl text-sm leading-7 text-slate-600">
          The create flow exercises the shared validation contract, the authenticated API, and the
          dashboard shell.
        </p>
      </div>
      <Card>
        <ProjectForm mode="create" />
      </Card>
    </div>
  );
}
