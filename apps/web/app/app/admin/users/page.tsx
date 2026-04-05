import { forbidden } from 'next/navigation';
import { Badge, Card } from '@packages/ui';
import { RoleForm } from '../../../../components/role-form';
import { formatDate, roleTone } from '../../../../lib/display';
import { getUsers, requireCurrentUser } from '../../../../lib/server-api';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const currentUser = await requireCurrentUser();

  if (currentUser.role === 'member') {
    forbidden();
  }

  const resolvedSearchParams = await searchParams;
  const page = getSingleValue(resolvedSearchParams.page) ?? '1';
  const users = await getUsers({
    page: Number(page),
    pageSize: 20
  });

  return (
    <div className="grid gap-6">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Admin console</p>
        <h1 className="text-4xl font-black tracking-tight text-slate-950">Users</h1>
        <p className="max-w-2xl text-sm leading-7 text-slate-600">
          Admins can review accounts. The owner can change roles, which validates RBAC and audit
          logging end to end.
        </p>
      </section>
      <div className="grid gap-4">
        {users.items.map((user) => (
          <Card
            className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_260px]"
            data-testid={`admin-user-${user.email}`}
            key={user.id}
          >
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={roleTone(user.role)}>{user.role}</Badge>
                {user.id === currentUser.id ? <Badge tone="slate">current user</Badge> : null}
              </div>
              <h2 className="text-xl font-bold text-slate-950">{user.name}</h2>
              <p className="text-sm text-slate-600">{user.email}</p>
            </div>
            <div className="grid gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
              <span>Created {formatDate(user.createdAt)}</span>
              <span>Updated {formatDate(user.updatedAt)}</span>
            </div>
            <div>
              {currentUser.role === 'owner' ? (
                <RoleForm user={user} />
              ) : (
                <p className="text-sm text-slate-600">
                  Owners can change roles. Admins are read-only here.
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
