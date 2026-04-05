'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { UserSummary } from '@packages/shared';
import { Button, Field, Input } from '@packages/ui';
import { clientApiRequest, clientSchemas } from '../lib/client-api';
import { toApiError } from '../lib/api-error';

export function ProfileForm({ user }: { user: UserSummary }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);

    try {
      await clientApiRequest('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: formData.get('name')
        })
      }, {
        schema: clientSchemas.user
      });

      router.refresh();
    } catch (caughtError) {
      setError(toApiError(caughtError).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="grid gap-5" data-testid="profile-form">
      <Field hint="This is the display name used across the dashboard." label="Name">
        <Input data-testid="profile-name" defaultValue={user.name} name="name" required />
      </Field>
      <Field label="Email">
        <Input defaultValue={user.email} disabled name="email" type="email" />
      </Field>
      <Field hint="Roles are assigned in the admin console." label="Role">
        <Input defaultValue={user.role} disabled name="role" />
      </Field>
      {error ? <p className="text-sm text-rose-600" data-testid="profile-error">{error}</p> : null}
      <Button data-testid="profile-save" disabled={pending} type="submit">
        {pending ? 'Saving...' : 'Save profile'}
      </Button>
    </form>
  );
}
