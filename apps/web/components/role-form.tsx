'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Role, UserSummary } from '@packages/shared';
import { Button, Select } from '@packages/ui';
import { toApiError } from '../lib/api-error';
import { clientApiRequest } from '../lib/client-api';

export function RoleForm({ user }: { user: UserSummary }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);

    try {
      await clientApiRequest<UserSummary>(`/api/admin/users/${user.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: formData.get('role') as Role
        })
      });

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
    <form action={handleSubmit} className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select defaultValue={user.role} name="role">
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </Select>
        <Button disabled={pending} type="submit" variant="secondary">
          {pending ? 'Saving...' : 'Update'}
        </Button>
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </form>
  );
}
