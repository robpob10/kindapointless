'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GAME_ID, TITLE } from '@/lib/config';

type Row = { username: string; question: string; answer: string; timestamp: string };

export default function AdminPanel({
  homeHref = '/',
  homeLabel = TITLE,
}: {
  homeHref?: string;
  homeLabel?: string;
}) {
  const storageKey = GAME_ID + '-admin-key';
  const [key, setKey] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState<{ err: boolean; text: string }>({ err: false, text: '' });
  const [loadedAt, setLoadedAt] = useState('');

  function qs(k: string) {
    const kp = k.trim() ? '&key=' + encodeURIComponent(k.trim()) : '';
    return kp + '&_=' + Date.now(); // cache-bust so reads are always fresh
  }

  async function doLoad(k: string) {
    setNote({ err: false, text: 'Loading…' });
    try {
      const r = await fetch('/api/submissions?format=json' + qs(k), { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) {
        setNote({ err: true, text: j.error || 'Error ' + r.status });
        return;
      }
      setRows(j.rows || []);
      setNote({ err: false, text: '' });
      const d = new Date();
      setLoadedAt(d.toLocaleTimeString());
    } catch {
      setNote({ err: true, text: 'Network error.' });
    }
  }

  // Remember the key and auto-load fresh data on every visit.
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(storageKey)) || '';
    if (saved) {
      setKey(saved);
      void doLoad(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyChange(v: string) {
    setKey(v);
    try {
      localStorage.setItem(storageKey, v);
    } catch {
      /* ignore */
    }
  }

  function download(fmt: 'csv' | 'json') {
    window.location.href = '/api/submissions?format=' + fmt + qs(key);
  }

  // aggregate
  const people = new Set(rows.map((r) => r.username.toLowerCase()));
  const byQuestion: Record<string, Record<string, { label: string; n: number }>> = {};
  for (const r of rows) {
    const q = (byQuestion[r.question] = byQuestion[r.question] || {});
    const norm = r.answer.trim().toLowerCase();
    q[norm] = q[norm] || { label: r.answer.trim(), n: 0 };
    q[norm].n++;
  }
  const questions = Object.keys(byQuestion);

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 pb-24">
      <Link href={homeHref} className="text-sm font-semibold text-zinc-400 hover:text-white">
        ← {homeLabel}
      </Link>
      <h1 className="mb-2 mt-2 text-3xl font-black tracking-tight sm:text-4xl">Admin</h1>
      <p className="mb-5 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
        Load the submissions, eyeball the raw answers, then download the dataset. Bucket similar answers
        (e.g. &ldquo;UK&rdquo; = &ldquo;Great Britain&rdquo;) before building the game board.
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <input
          type="text"
          value={key}
          onChange={(e) => onKeyChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') doLoad(key);
          }}
          placeholder="Admin key"
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-[15px] text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
          size={30}
        />
        <button
          onClick={() => doLoad(key)}
          className="rounded-xl bg-white px-4 py-2.5 text-[15px] font-extrabold tracking-tight text-black hover:bg-zinc-200"
        >
          Load submissions
        </button>
        <button
          onClick={() => download('csv')}
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-[15px] font-bold hover:border-zinc-600"
        >
          Download CSV
        </button>
        <button
          onClick={() => download('json')}
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-[15px] font-bold hover:border-zinc-600"
        >
          Download JSON
        </button>
      </div>
      <p className={`mb-4 min-h-[20px] text-[15px] ${note.err ? 'text-rose-400' : 'text-zinc-400'}`}>
        {note.text || (loadedAt && `Loaded at ${loadedAt}`)}
      </p>

      <div className="mb-6 flex flex-wrap gap-2.5">
        <Stat n={rows.length} label="answers" />
        <Stat n={people.size} label="people" />
        <Stat n={questions.length} label="questions" />
      </div>

      {questions.length === 0 ? (
        <p className="text-zinc-400">No submissions loaded yet — enter the admin key and hit Load.</p>
      ) : (
        questions.map((q) => {
          const entries = Object.values(byQuestion[q]).sort((a, b) => b.n - a.n);
          return (
            <div key={q} className="my-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
              <h3 className="mb-3 text-[15px] font-extrabold tracking-tight">{q}</h3>
              <div className="flex flex-wrap gap-2">
                {entries.map((e) => (
                  <span
                    key={e.label}
                    className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-sm"
                  >
                    {e.label} <b className="ml-0.5 font-extrabold text-white">×{e.n}</b>
                  </span>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="min-w-[120px] rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3.5">
      <b className="block text-3xl font-black tracking-tight">{n}</b>
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
    </div>
  );
}
