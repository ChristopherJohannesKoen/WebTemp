'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Project } from '@packages/shared';
import { Button } from '@packages/ui';
import { toApiError } from '../lib/api-error';
import { clientApiRequest } from '../lib/client-api';

export function ProjectActions({ project }: { project: Project }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<'archive' | 'delete'>();
  const [error, setError] = useState<string>();

  async function handleArchiveToggle() {
    setPendingAction('archive');
    setError(undefined);

    try {
      await clientApiRequest<Project>(`/api/projects/${project.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isArchived: !project.isArchived
        })
      });

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
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-3">
        <Button
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
          disabled={pendingAction !== undefined}
          onClick={handleDelete}
          type="button"
          variant="danger"
        >
          {pendingAction === 'delete' ? 'Deleting...' : 'Delete project'}
        </Button>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
