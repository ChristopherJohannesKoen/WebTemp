'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SessionSummary } from '@packages/shared';
import { Badge, Button } from '@packages/ui';
import { logout, logoutAll, revokeSession } from '../lib/client-api';
import { toApiError } from '../lib/api-error';

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function SessionManagement({ sessions }: { sessions: SessionSummary[] }) {
  const router = useRouter();
  const [pendingSessionId, setPendingSessionId] = useState<string>();
  const [pendingLogoutAll, setPendingLogoutAll] = useState(false);
  const [error, setError] = useState<string>();

  async function handleCurrentLogout() {
    setPendingSessionId('current');
    setError(undefined);

    try {
      await logout();

      router.push('/login');
    } catch (caughtError) {
      setError(toApiError(caughtError).message);
    } finally {
      setPendingSessionId(undefined);
    }
  }

  async function handleRevokeSession(sessionId: string) {
    setPendingSessionId(sessionId);
    setError(undefined);

    try {
      const response = await revokeSession(sessionId);

      if (response.revokedCurrent) {
        router.push('/login');
      } else {
        router.refresh();
      }
    } catch (caughtError) {
      setError(toApiError(caughtError).message);
    } finally {
      setPendingSessionId(undefined);
    }
  }

  async function handleLogoutAll() {
    setPendingLogoutAll(true);
    setError(undefined);

    try {
      await logoutAll();

      router.push('/login');
    } catch (caughtError) {
      setError(toApiError(caughtError).message);
    } finally {
      setPendingLogoutAll(false);
    }
  }

  return (
    <div className="grid gap-4" data-testid="session-management">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Security state</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Active sessions</h2>
        </div>
        <Button
          data-testid="logout-all-sessions"
          disabled={pendingLogoutAll}
          onClick={handleLogoutAll}
          type="button"
          variant="secondary"
        >
          {pendingLogoutAll ? 'Signing out...' : 'Sign out everywhere'}
        </Button>
      </div>

      <div className="grid gap-3">
        {sessions.map((session) => (
          <div
            className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto]"
            data-current={session.isCurrent ? 'true' : 'false'}
            data-session-id={session.id}
            data-testid="session-row"
            key={session.id}
          >
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {session.isCurrent ? <Badge tone="emerald">current session</Badge> : null}
                <span className="text-sm font-semibold text-slate-900">
                  {session.userAgent ?? 'Unknown device'}
                </span>
              </div>
              <div className="grid gap-1 text-sm text-slate-600">
                <span>IP: {session.ipAddress ?? 'Unavailable'}</span>
                <span>Last used: {formatTimestamp(session.lastUsedAt)}</span>
                <span>Expires: {formatTimestamp(session.expiresAt)}</span>
              </div>
            </div>
            <div className="flex items-start justify-end">
              {session.isCurrent ? (
                <Button
                  data-testid="current-session-sign-out"
                  disabled={pendingSessionId !== undefined}
                  onClick={handleCurrentLogout}
                  type="button"
                  variant="secondary"
                >
                  {pendingSessionId === 'current' ? 'Signing out...' : 'Sign out'}
                </Button>
              ) : (
                <Button
                  data-testid="revoke-session"
                  disabled={pendingSessionId !== undefined}
                  onClick={() => handleRevokeSession(session.id)}
                  type="button"
                  variant="ghost"
                >
                  {pendingSessionId === session.id ? 'Revoking...' : 'Revoke'}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-rose-600" data-testid="session-management-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
