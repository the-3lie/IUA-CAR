import { sessionCourante } from '@/lib/session';
import Shell from '@/components/admin/Shell';

export const metadata = { title: 'Administration' };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await sessionCourante();
  return <Shell nom={s?.nom ?? 'Administrateur'}>{children}</Shell>;
}
