'use client';

import { useCallback } from 'react';
import { NAME, TITLE } from '@/lib/config';

export default function HomeRules({
  title = TITLE,
  subject = NAME,
  loseLabel = 'Lose',
  winLabel = 'Win',
}: {
  title?: string;
  subject?: string;
  loseLabel?: string;
  winLabel?: string;
}) {
  const speak = useCallback(() => {
    try {
      const s = window.speechSynthesis;
      if (!s) return;
      s.cancel();
      const text =
        `Here's how ${title} works. Before the day, everyone submitted answers to questions about ${subject}. ` +
        "On the day, each question's board is revealed on the screen — the answers two or more of us gave first, then the ones only one person gave. " +
        `${subject} then has to name an answer. Landing on one that only a single person submitted nails it, and everyone drinks. ` +
        `But naming an answer two or more people gave, or something nobody said at all, means ${subject} drinks.`;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      s.speak(u);
    } catch {
      /* ignore */
    }
  }, [title, subject]);

  return (
    <div className="mt-8 rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">How {title} works</h2>
        <button
          onClick={speak}
          className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:border-zinc-600"
        >
          🔊 Read
        </button>
      </div>
      <ol className="list-decimal space-y-2 pl-5 leading-relaxed text-zinc-200">
        <li>Before the day, everyone secretly submitted answers to questions about {subject}.</li>
        <li>
          On the day, each question’s board is revealed on the screen — the answers <b>2+ of us gave</b>{' '}
          (<span className="text-rose-400">{loseLabel}</span>) first, then the ones <b>only one person gave</b>{' '}
          (<span className="text-green-400">{winLabel}</span>).
        </li>
        <li>
          {subject} has to name an answer. Land on a <b className="text-green-400">{winLabel}</b> answer — one
          only a single person submitted — and it’s genius: <b>everyone drinks</b>. 🍺
        </li>
        <li>
          Name an answer <b>2+ people gave</b>, or something nobody said, and it’s a fail:{' '}
          <b>{subject} drinks</b>. 💀
        </li>
      </ol>
    </div>
  );
}
