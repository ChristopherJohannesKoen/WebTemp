'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Project } from '@packages/shared';
import { Button } from '@packages/ui';
import { toApiError } from '../lib/api-error';
import { clientApiRequest } from '../lib/client-api';

export function ProjectActions({
  onChanged,
  project
}: {
  onChanged?: (project: Project) => void;
  project: Project;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<'archive' | 'delete'>();
  const [error, setError] = useState<string>();

  async function handleArchiveToggle() {
    setPendingAction('archive');
    setError(undefined);

    try {
      const updatedProject = await clientApiRequest<Project>(`/api/projects/${project.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isArchived: !project.isArchived
        })
      });

      onChanged?.(updatedProject);
      router.refresh();
    } catch (caughtError) {
      setError(toApiError(caughtError).message);
    } finally {
      setPendingAction(undefined);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm('Delete this project permanently?');

    if (!confirmed) {
      return;
    }

    setPendingAction('delete');
    setError(undefined);

    try {
      await clientApiRequest(`/api/projects/${project.id}`, {
        method: 'DELETE'
      });

      router.push('/app/projects');
      router.refresh();
    } catch (caughtError) {
      setError(toApiError(caughtError).message);
    } finally {
      setPendingAction(undefined);
    }
  }

  return (
    <div className="grid gap-3" data-testid="project-actions">
      <div className="flex flex-wrap gap-3">
        <Button
          data-testid="project-archive-toggle"
          disabled={pendingAction !== undefined}
          onClick={handleArchiveToggle}
          type="button"
          variant="secondary"
        >
          {pendingAction === 'archive'
            ? 'Updating...'
            : project.isArchived
              ? 'Restore project'
              : 'Archive project'}
        </Button>
        <Button
          data-testid="project-delete"
          disabled={pendingAction !== undefined}
          onClick={handleDelete}
          type="button"
          variant="danger"
        >
          {pendingAction === 'delete' ? 'Deleting...' : 'Delete project'}
        </Button>
      </div>
      {error ? <p className="text-sm text-rose-600" data-testid="project-actions-error">{error}</p> : null}
    </div>
  );
}
