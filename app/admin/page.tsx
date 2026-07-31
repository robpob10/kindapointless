import AdminPanel from '@/components/AdminPanel';
import { getSiteSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const s = await getSiteSettings();
  return <AdminPanel homeLabel={s.title} />;
}
