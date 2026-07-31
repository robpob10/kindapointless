import CollectForm from '@/components/CollectForm';
import { getSiteSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function CollectPage() {
  const s = await getSiteSettings();
  return <CollectForm subject={s.name} homeLabel={s.title} />;
}
