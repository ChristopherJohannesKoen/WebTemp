'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Role, UserSummary } from '@packages/shared';
import { Button, Input, Select } from '@packages/ui';
import { completeStepUp, updateUserRole } from '../lib/client-api';
import { toApiError } from '../lib/api-error';

export function RoleForm({ user }: { user: UserSummary }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [stepUpRequired, setStepUpRequired] = useState(false);
  const [stepUpPassword, setStepUpPassword] = useState('');

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);

    try {
      const nextRole = formData.get('role') as Role;

      if (stepUpRequired) {
        await completeStepUp(stepUpPassword);
      }

      await updateUserRole(user.id, nextRole);

      setStepUpRequired(false);
      setStepUpPassword('');
      router.refresh();
    } catch (caughtError) {
      const apiError = toApiError(caughtError);

      if (apiError.code === 'step_up_required') {
        setStepUpRequired(true);
      }

      setError(apiError.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="grid gap-2" data-testid="role-form">
      <div className="flex flex-wrap items-center gap-2">
        <Select data-testid="role-select" defaultValue={user.role} name="role">
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </Select>
        <Button data-testid="role-submit" disabled={pending} type="submit" variant="secondary">
          {pending ? 'Saving...' : 'Update'}
        </Button>
      </div>
      {stepUpRequired ? (
        <div className="grid gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-800">
            Owner confirmation required
          </p>
          <Input
            autoComplete="current-password"
            data-testid="role-step-up-password"
            name="step-up-password"
            onChange={(event) => setStepUpPassword(event.target.value)}
            placeholder="Re-enter your password"
            type="password"
            value={stepUpPassword}
          />
        </div>
      ) : null}
      {error ? (
        <p className="text-xs text-rose-600" data-testid="role-form-error">
          {error}
        </p>
      ) : null}
    </form>
  );
}
