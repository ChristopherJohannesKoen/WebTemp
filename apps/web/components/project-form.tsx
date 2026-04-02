'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Project, ProjectUpsertPayload } from '@packages/shared';
import { Button, Field, Input, Select, Textarea } from '@packages/ui';
import { toApiError } from '../lib/api-error';
import { clientApiRequest } from '../lib/client-api';

type ProjectFormProps = {
  mode: 'create' | 'edit';
  onSaved?: (project: Project) => void;
  project?: Project;
};

export function ProjectForm({ mode, onSaved, project }: ProjectFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);

    const payload: ProjectUpsertPayload = {
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      status: (formData.get('status') as ProjectUpsertPayload['status']) ?? 'active',
      isArchived: formData.get('isArchived') === 'on'
    };

    try {
      const response = await clientApiRequest<Project>(
        project ? `/api/projects/${project.id}` : '/api/projects',
        {
          method: project ? 'PATCH' : 'POST',
          body: JSON.stringify(payload)
        },
        {
          idempotent: !project
        }
      );

      if (project) {
        onSaved?.(response);
      } else {
        router.push(`/app/projects/${response.id}`);
      }

      router.refresh();
    } catch (caughtError) {
      setError(toApiError(caughtError).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="grid gap-5" data-testid={`project-form-${mode}`}>
      <Field hint="Short, specific, and reusable." label="Project name">
        <Input
          data-testid="project-name"
          defaultValue={project?.name}
          name="name"
          placeholder="Client portal rebuild"
          required
        />
      </Field>
      <Field
        hint="This becomes the example long-form field across the template."
        label="Description"
      >
        <Textarea
          data-testid="project-description"
          defaultValue={project?.description ?? ''}
          name="description"
          placeholder="Summarize goals, scope, and the next important milestone."
        />
      </Field>
      <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
        <Field label="Status">
          <Select data-testid="project-status" defaultValue={project?.status ?? 'active'} name="status">
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </Select>
        </Field>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            className="size-4"
            data-testid="project-is-archived"
            defaultChecked={project?.isArchived}
            name="isArchived"
            type="checkbox"
          />
          Archive after save
        </label>
      </div>
      {error ? <p className="text-sm text-rose-600" data-testid="project-form-error">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button data-testid="project-submit" disabled={pending} type="submit">
          {pending ? 'Saving...' : mode === 'create' ? 'Create project' : 'Save changes'}
        </Button>
        <Button onClick={() => router.back()} type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}
