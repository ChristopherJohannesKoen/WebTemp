import { Badge, Card } from '@packages/ui';
import { ProfileForm } from '../../../components/profile-form';
import { SessionManagement } from '../../../components/session-management';
import { roleTone } from '../../../lib/display';
import { getSessions, getUserProfile } from '../../../lib/server-api';

export default async function SettingsPage() {
  const user = await getUserProfile();
  const sessions = await getSessions();

  return (
    <div className="grid gap-6">
      <section className="space-y-2">
        <Badge tone={roleTone(user.role)}>{user.role}</Badge>
        <h1 className="text-4xl font-black tracking-tight text-slate-950">Settings</h1>
        <p className="max-w-2xl text-sm leading-7 text-slate-600">
          This page exercises the authenticated profile API and gives future projects a baseline
          account settings screen.
        </p>
      </section>
      <Card>
        <ProfileForm user={user} />
      </Card>
      <Card>
        <SessionManagement sessions={sessions.items} />
      </Card>
    </div>
  );
}
