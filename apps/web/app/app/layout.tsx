import { AppShell } from '../../components/app-shell';
import { requireCurrentUser } from '../../lib/server-api';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await requireCurrentUser();

  return <AppShell currentUser={currentUser}>{children}</AppShell>;
}
