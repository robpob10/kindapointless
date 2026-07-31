'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { GAME_ID, TITLE } from '@/lib/config';

type Row = { username: string; question: string; answer: string; timestamp: string };
type SettingsForm = { name: string; winWord: string; loseWord: string };

const EMPTY_FORM: SettingsForm = { name: '', winWord: '', loseWord: '' };

export default function AdminPanel({
  homeHref = '/',
  homeLabel = TITLE,
}: {
  homeHref?: string;
  homeLabel?: string;
}) {
  const storageKey = GAME_ID + '-admin-key';
  const [key, setKey] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [unlockNote, setUnlockNote] = useState('');
  const [setupHint, setSetupHint] = useState('');

  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState<{ err: boolean; text: string }>({ err: false, text: '' });
  const [loadedAt, setLoadedAt] = useState('');

  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ err: boolean; text: string } | null>(null);

  const [confirmKey, setConfirmKey] = useState('');
  const [armed, setArmed] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<{ err: boolean; text: string } | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function qs(k: string) {
    return '&key=' + encodeURIComponent(k.trim()) + '&_=' + Date.now(); // cache-bust so reads are always fresh
  }

  // Validate the key server-side; only a correct key reveals the panel.
  async function unlock(k: string) {
    if (!k.trim()) {
      setUnlockNote('Enter the admin key.');
      return;
    }
    setUnlockNote('Checking…');
    try {
      const r = await fetch('/api/settings?x=1' + qs(k), { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setUnlockNote(j.error === 'bad admin key' ? 'Wrong key.' : j.error || 'Error ' + r.status);
        return;
      }
      setUnlocked(true);
      setUnlockNote('');
      if (j.hint) setSetupHint(j.hint);
      if (j.raw) setForm({ name: j.raw.name || '', winWord: j.raw.winWord || '', loseWord: j.raw.loseWord || '' });
      try {
        localStorage.setItem(storageKey, k);
      } catch {
        /* ignore */
      }
      void doLoad(k);
    } catch {
      setUnlockNote('Network error — try again.');
    }
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

  // Try the remembered key on every visit.
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(storageKey)) || '';
    if (saved) {
      setKey(saved);
      void unlock(saved);
    }
    return () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSettings() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim(), ...form }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        if (j.raw) setForm({ name: j.raw.name || '', winWord: j.raw.winWord || '', loseWord: j.raw.loseWord || '' });
        setSaveMsg({ err: false, text: 'Saved ✓ — the site updates immediately.' });
      } else {
        if (j.hint) setSetupHint(j.hint);
        setSaveMsg({ err: true, text: j.error || 'Could not save.' });
      }
    } catch {
      setSaveMsg({ err: true, text: 'Network error — try again.' });
    } finally {
      setSaving(false);
    }
  }

  function disarm() {
    setArmed(false);
    if (armTimer.current) {
      clearTimeout(armTimer.current);
      armTimer.current = null;
    }
  }

  // Clear DB needs the key typed AGAIN, then TWO presses of the button.
  async function clearDb() {
    setClearMsg(null);
    if (!confirmKey.trim()) {
      setClearMsg({ err: true, text: 'Re-enter the admin key first.' });
      return;
    }
    if (!armed) {
      setArmed(true);
      setClearMsg({
        err: false,
        text: 'Armed. Press the button again within 8 seconds to permanently wipe everything.',
      });
      armTimer.current = setTimeout(() => {
        setArmed(false);
        setClearMsg(null);
      }, 8000);
      return;
    }
    disarm();
    setClearing(true);
    try {
      const r = await fetch('/api/reset?x=1' + qs(confirmKey), { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setRows([]);
        setForm(EMPTY_FORM);
        setConfirmKey('');
        setLoadedAt('');
        setClearMsg({ err: false, text: 'Database cleared — name, win/lose words, and all answers are gone.' });
      } else {
        setClearMsg({ err: true, text: j.error === 'bad admin key' ? 'Wrong key.' : j.error || 'Could not clear.' });
      }
    } catch {
      setClearMsg({ err: true, text: 'Network error — nothing was cleared.' });
    } finally {
      setClearing(false);
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

  const inputCls =
    'rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-[15px] text-white placeholder-zinc-500 outline-none focus:border-zinc-500';

  // ---- locked view: nothing but the key prompt ----
  if (!unlocked) {
    return (
      <div className="mx-auto w-full max-w-[420px] px-4 py-6">
        <Link href={homeHref} className="text-sm font-semibold text-zinc-400 hover:text-white">
          ← {homeLabel}
        </Link>
        <h1 className="mb-2 mt-2 text-3xl font-black tracking-tight sm:text-4xl">Admin</h1>
        <p className="mb-5 text-[15px] text-zinc-400">Enter the admin key to see the options.</p>
        <div className="flex gap-2.5">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') unlock(key);
            }}
            placeholder="Admin key"
            autoComplete="off"
            className={inputCls + ' w-full'}
          />
          <button
            onClick={() => unlock(key)}
            className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-[15px] font-extrabold tracking-tight text-black hover:bg-zinc-200"
          >
            Unlock
          </button>
        </div>
        <p className="mt-3 min-h-[20px] text-sm text-rose-400">{unlockNote}</p>
      </div>
    );
  }

  // ---- unlocked view ----
  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 pb-24">
      <Link href={homeHref} className="text-sm font-semibold text-zinc-400 hover:text-white">
        ← {homeLabel}
      </Link>
      <h1 className="mb-2 mt-2 text-3xl font-black tracking-tight sm:text-4xl">Admin</h1>

      {setupHint && (
        <div className="mb-4 rounded-xl border border-rose-500 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          ⚠ {setupHint}
        </div>
      )}

      {/* Site settings */}
      <div className="mb-6 rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">Site settings</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Leave a field empty to use the default (shown greyed out).
        </p>
        <div className="flex flex-wrap gap-3">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5 text-sm font-bold">
            Name
            <input
              type="text"
              value={form.name}
              maxLength={60}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="<name>"
              className={inputCls}
            />
          </label>
          <label className="flex min-w-[150px] flex-1 flex-col gap-1.5 text-sm font-bold">
            Win word
            <input
              type="text"
              value={form.winWord}
              maxLength={40}
              onChange={(e) => setForm((f) => ({ ...f, winWord: e.target.value }))}
              placeholder="Win"
              className={inputCls}
            />
          </label>
          <label className="flex min-w-[150px] flex-1 flex-col gap-1.5 text-sm font-bold">
            Lose word
            <input
              type="text"
              value={form.loseWord}
              maxLength={40}
              onChange={(e) => setForm((f) => ({ ...f, loseWord: e.target.value }))}
              placeholder="Lose"
              className={inputCls}
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="rounded-xl bg-white px-4 py-2.5 text-[15px] font-extrabold tracking-tight text-black hover:bg-zinc-200 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          {saveMsg && (
            <span className={`text-sm ${saveMsg.err ? 'text-rose-400' : 'text-green-400'}`}>{saveMsg.text}</span>
          )}
        </div>
      </div>

      {/* Submissions */}
      <p className="mb-5 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
        Load the submissions, eyeball the raw answers, then download the dataset. Bucket similar answers
        (e.g. &ldquo;UK&rdquo; = &ldquo;Great Britain&rdquo;) before building the game board.
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <button
          onClick={() => doLoad(key)}
          className="rounded-xl bg-white px-4 py-2.5 text-[15px] font-extrabold tracking-tight text-black hover:bg-zinc-200"
        >
          Reload submissions
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
        <Stat n={people.size} label="devices" />
        <Stat n={questions.length} label="questions" />
      </div>

      {questions.length === 0 ? (
        <p className="text-zinc-400">No submissions yet.</p>
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

      {/* Danger zone */}
      <div className="mt-10 rounded-2xl border border-rose-500/50 bg-rose-500/5 p-5">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-rose-400">Danger zone</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Clears the name, win word, lose word, and <b className="text-zinc-200">every submitted answer</b>.
          There is no undo. Re-enter the admin key, then press the button <b className="text-zinc-200">twice</b>.
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="password"
            value={confirmKey}
            onChange={(e) => {
              setConfirmKey(e.target.value);
              disarm();
            }}
            placeholder="Re-enter admin key"
            autoComplete="off"
            className={inputCls}
            size={22}
          />
          <button
            onClick={clearDb}
            disabled={clearing || !confirmKey.trim()}
            className={
              'rounded-xl border-2 px-4 py-2.5 text-[15px] font-extrabold tracking-tight transition-colors disabled:opacity-40 ' +
              (armed
                ? 'border-rose-500 bg-rose-600 text-white hover:bg-rose-500'
                : 'border-rose-500/60 bg-transparent text-rose-300 hover:bg-rose-500/15')
            }
          >
            {clearing ? 'Clearing…' : armed ? '⚠ Press again to wipe everything' : 'Clear database'}
          </button>
        </div>
        {clearMsg && (
          <p className={`mt-3 text-sm ${clearMsg.err ? 'text-rose-400' : 'text-green-400'}`}>{clearMsg.text}</p>
        )}
      </div>
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
