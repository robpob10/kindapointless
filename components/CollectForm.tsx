'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { NAME, TITLE } from '@/lib/config';

export default function CollectForm({
  subject = NAME,
  homeHref = '/',
  homeLabel = TITLE,
}: {
  subject?: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  const [username, setUsername] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ q: string; kind: 'ok' | 'err'; text: string } | null>(null);
  const [setupError, setSetupError] = useState('');

  const [newQ, setNewQ] = useState('');
  const [addingQ, setAddingQ] = useState(false);
  const [qMsg, setQMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const nameOk = username.trim().length > 0;
  const getDraft = (q: string) => draft[q] ?? '';
  const getSaved = (q: string) => saved[q] ?? [];

  // Load the live question list (base + any custom ones people added).
  useEffect(() => {
    let alive = true;
    fetch('/api/questions?_=' + Date.now(), { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (alive && Array.isArray(j.questions) && j.questions.length) setQuestions(j.questions);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function submitOne(q: string) {
    const name = username.trim();
    if (!name) {
      setMsg({ q, kind: 'err', text: 'Enter your name at the top first 🙂' });
      return;
    }
    const answer = getDraft(q).trim();
    if (!answer) {
      setMsg({ q, kind: 'err', text: 'Type an answer first.' });
      return;
    }
    if (getSaved(q).some((a) => a.toLowerCase() === answer.toLowerCase())) {
      setMsg({ q, kind: 'err', text: 'You already added that one.' });
      return;
    }

    setBusy(q);
    setMsg(null);
    setSetupError('');
    try {
      const r = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name, items: [{ question: q, answer }] }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setSaved((prev) => ({ ...prev, [q]: [...(prev[q] ?? []), answer] }));
        setDraft((prev) => ({ ...prev, [q]: '' }));
        setMsg({ q, kind: 'ok', text: `Saved “${answer}” ✓` });
      } else {
        if (j.hint) setSetupError(j.hint);
        setMsg({ q, kind: 'err', text: j.error || 'Something went wrong.' });
      }
    } catch {
      setMsg({ q, kind: 'err', text: 'Network error - try again.' });
    } finally {
      setBusy(null);
    }
  }

  async function addNewQuestion() {
    const t = newQ.trim();
    if (!t) return;
    setAddingQ(true);
    setQMsg(null);
    setSetupError('');
    try {
      const r = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        if (Array.isArray(j.questions)) setQuestions(j.questions);
        setNewQ('');
        setQMsg({ kind: 'ok', text: 'Question added ✓' });
      } else {
        if (j.hint) setSetupError(j.hint);
        setQMsg({ kind: 'err', text: j.error || 'Could not add question.' });
      }
    } catch {
      setQMsg({ kind: 'err', text: 'Network error - try again.' });
    } finally {
      setAddingQ(false);
    }
  }

  const totalSaved = Object.values(saved).reduce((s, a) => s + a.length, 0);

  return (
    <div className="mx-auto w-full max-w-[620px] px-4 py-6 pb-24">
      <Link href={homeHref} className="text-sm font-semibold text-zinc-400 hover:text-white">
        ← {homeLabel}
      </Link>

      <div className="mb-6 mt-5 rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">How this works</h2>
        <ol className="list-decimal space-y-2 pl-5 leading-relaxed text-zinc-200">
          <li>Add as many answers as you want to each question.</li>
          <li>
            On the day, {subject} has to guess the answer that the fewest of us gave (without landing on an
            answer nobody said). Lowest non-zero answer → we all drink; otherwise {subject} drinks.
          </li>
          <li>Joke answers are allowed but I reserve the right to prune them.</li>
        </ol>
      </div>

      {setupError && (
        <div className="mb-4 rounded-xl border border-rose-500 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          ⚠ {setupError}
        </div>
      )}

      <label htmlFor="username" className="mb-2 block font-extrabold tracking-tight">
        Your name
      </label>
      <input
        id="username"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="e.g. Dave"
        autoComplete="off"
        className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-3 text-base text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
      />
      {!nameOk && <p className="mt-1.5 text-sm text-zinc-500">Enter your name to start adding answers.</p>}

      <div className="mt-3">
        {questions.map((q, qi) => (
          <div key={q} className="my-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
            <h3 className="text-[17px] font-extrabold tracking-tight">
              {qi + 1}. {q}
            </h3>
            <p className="mb-3 mt-0.5 text-sm font-bold text-green-400">Submit multiple pls</p>

            {getSaved(q).length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {getSaved(q).map((a, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-sm text-green-300"
                  >
                    ✓ {a}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={getDraft(q)}
                disabled={!nameOk || busy === q}
                onChange={(e) => setDraft((prev) => ({ ...prev, [q]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitOne(q);
                  }
                }}
                placeholder={getSaved(q).length ? 'Add another…' : 'Type an answer…'}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-base text-white placeholder-zinc-500 outline-none focus:border-zinc-500 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => submitOne(q)}
                disabled={!nameOk || busy === q || !getDraft(q).trim()}
                className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-[15px] font-extrabold tracking-tight text-black transition-colors hover:bg-zinc-200 disabled:opacity-40"
              >
                {busy === q ? 'Saving…' : 'Submit'}
              </button>
            </div>

            {msg && msg.q === q && (
              <p className={`mt-2 text-sm ${msg.kind === 'ok' ? 'text-green-400' : 'text-rose-400'}`}>
                {msg.text}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Add your own question */}
      <div className="my-3 rounded-2xl border border-dashed border-zinc-600 bg-zinc-900/60 p-4">
        <h3 className="mb-3 text-[15px] font-extrabold tracking-tight">Add a question</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newQ}
            disabled={addingQ}
            onChange={(e) => setNewQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addNewQuestion();
              }
            }}
            placeholder={`e.g. Name a film ${subject} quotes constantly`}
            maxLength={200}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-base text-white placeholder-zinc-500 outline-none focus:border-zinc-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={addNewQuestion}
            disabled={addingQ || !newQ.trim()}
            className="shrink-0 rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-[15px] font-extrabold tracking-tight text-white transition-colors hover:border-zinc-500 disabled:opacity-40"
          >
            {addingQ ? 'Adding…' : 'Add question'}
          </button>
        </div>
        {qMsg && (
          <p className={`mt-2 text-sm ${qMsg.kind === 'ok' ? 'text-green-400' : 'text-rose-400'}`}>{qMsg.text}</p>
        )}
      </div>

      <p className="mt-6 text-center text-[15px] text-zinc-400">
        {totalSaved > 0
          ? `${totalSaved} answer${totalSaved === 1 ? '' : 's'} saved. Add more any time.`
          : 'Your answers save one at a time as you go.'}
      </p>
    </div>
  );
}
