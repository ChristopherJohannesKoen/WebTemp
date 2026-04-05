'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Role, UserSummary } from '@packages/shared';
import { Button, Select } from '@packages/ui';
import { updateUserRole } from '../lib/client-api';
import { toApiError } from '../lib/api-error';

export function RoleForm({ user }: { user: UserSummary }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);

    try {
      await updateUserRole(user.id, formData.get('role') as Role);

      router.refresh();
    } catch (caughtError) {
      setError(toApiError(caughtError).message);
    } finally {
      setPending(false);
    }
  }

  if (user.role === 'owner') {
    return (
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Owner</span>
    );
  }

  return (
    <form action={handleSubmit} className="grid gap-2" data-testid="role-form">
      <div className="flex flex-wrap items-center gap-2">
        <Select data-testid="role-select" defaultValue={user.role} name="role">
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </Select>
        <Button data-testid="role-submit" disabled={pending} type="submit" variant="secondary">
          {pending ? 'Saving...' : 'Update'}
        </Button>
      </div>
      {error ? <p className="text-xs text-rose-600" data-testid="role-form-error">{error}</p> : null}
    </form>
  );
}
