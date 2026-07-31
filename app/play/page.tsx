import Link from 'next/link';
import PlayGame from '@/components/PlayGame';
import { GAME } from '@/lib/game';
import { getSiteSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function PlayPage() {
  const s = await getSiteSettings();
  if (GAME.questions.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">No questions yet</h1>
        <p className="max-w-md text-zinc-400">
          The game board is empty. After the collect phase, download the submissions from{' '}
          <code className="text-zinc-200">/admin</code>, bucket similar answers together, and add the
          questions to <code className="text-zinc-200">lib/game.ts</code>.
        </p>
        <Link href="/" className="text-sm font-semibold text-zinc-400 hover:text-white">
          ← {s.title}
        </Link>
      </main>
    );
  }
  return (
    <PlayGame name={s.name} winLabel={s.winWord} loseLabel={s.loseWord} homeLabel={s.title} />
  );
}
