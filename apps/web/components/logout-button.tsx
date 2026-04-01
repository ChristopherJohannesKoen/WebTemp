'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@packages/ui';
import { toApiError } from '../lib/api-error';
import { clientApiRequest } from '../lib/client-api';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleLogout() {
    setPending(true);
    setError(undefined);

    try {
      await clientApiRequest('/api/auth/logout', {
        method: 'POST'
      });

      router.push('/login');
      router.refresh();
    } catch (caughtError) {
      setError(toApiError(caughtError).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Button className="w-full" onClick={handleLogout} type="button" variant="secondary">
        {pending ? 'Signing out...' : 'Sign out'}
      </Button>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
