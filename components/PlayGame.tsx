'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { GAME, type Answer, type Game } from '@/lib/game';
import { NAME, TITLE } from '@/lib/config';

const WIN_CLIP_COUNT = 3; // public/win-1.ogg ... win-3.ogg

export default function PlayGame({
  game = GAME,
  name = NAME,
  loseLabel = 'Lose',
  winLabel = 'Win',
  homeHref = '/',
  homeLabel = TITLE,
}: {
  game?: Game;
  name?: string;
  loseLabel?: string;
  winLabel?: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  const questions = game.questions;
  const [qi, setQi] = useState(0);
  const [revealCount, setRevealCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  // Lose = 2+ submissions (no win); Win = exactly 1 submission (win).
  const { loseAnswers, winAnswers, total } = useMemo(() => {
    const a = questions[qi].answers;
    const lose = a.filter((x) => x.votes >= 2).slice().sort((x, y) => y.votes - x.votes);
    const win = a.filter((x) => x.votes <= 1);
    return { loseAnswers: lose, winAnswers: win, total: lose.length + win.length };
  }, [questions, qi]);

  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const playingRef = useRef(false);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest reveal state, readable inside async speech callbacks.
  const stateRef = useRef({ loseAnswers, winAnswers, total, revealCount });
  stateRef.current = { loseAnswers, winAnswers, total, revealCount };

  const cancelSpeech = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    if (fallbackRef.current) {
      clearTimeout(fallbackRef.current);
      fallbackRef.current = null;
    }
    if (pauseRef.current) {
      clearTimeout(pauseRef.current);
      pauseRef.current = null;
    }
  }, []);

  // Announce the verdict (adjudication buttons at the end).
  // Win plays one of the recorded clips at random; lose uses speech.
  const clipRef = useRef<HTMLAudioElement | null>(null);
  const announce = useCallback(
    (kind: 'win' | 'lose') => {
      if (kind === 'win') {
        try {
          if (clipRef.current) {
            clipRef.current.pause();
            clipRef.current.currentTime = 0;
          }
          const n = 1 + Math.floor(Math.random() * WIN_CLIP_COUNT);
          const a = new Audio(`/win-${n}.ogg`);
          clipRef.current = a;
          void a.play();
        } catch {
          /* ignore */
        }
        return;
      }
      try {
        const s = window.speechSynthesis;
        if (mutedRef.current || !s) return;
        s.cancel();
        const u = new SpeechSynthesisUtterance(`${loseLabel}! ${name} drinks!`);
        u.rate = 1;
        s.speak(u);
      } catch {
        /* ignore */
      }
    },
    [loseLabel, name]
  );

  // Speak `text`, then call `done` when it finishes (or a fallback fires).
  const speakThen = useCallback((text: string, done: () => void) => {
    let called = false;
    const finish = () => {
      if (called) return;
      called = true;
      if (fallbackRef.current) {
        clearTimeout(fallbackRef.current);
        fallbackRef.current = null;
      }
      done();
    };
    try {
      const synth = window.speechSynthesis;
      if (mutedRef.current || !synth || !text) {
        fallbackRef.current = setTimeout(finish, mutedRef.current ? 1200 : 400);
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      u.onend = finish;
      u.onerror = finish;
      synth.cancel();
      synth.speak(u);
      // safety net in case onend never fires (some browsers)
      fallbackRef.current = setTimeout(finish, Math.max(2500, text.length * 90));
    } catch {
      fallbackRef.current = setTimeout(finish, 800);
    }
  }, []);

  // Reveal the next answer, speak it, and chain to the next when speech ends.
  const step = useCallback(() => {
    if (!playingRef.current) return;
    const st = stateRef.current;
    if (st.revealCount >= st.total) {
      playingRef.current = false;
      setPlaying(false);
      return;
    }
    const idx = st.revealCount;
    const ans = idx < st.loseAnswers.length ? st.loseAnswers[idx] : st.winAnswers[idx - st.loseAnswers.length];
    stateRef.current.revealCount = idx + 1;
    setRevealCount(idx + 1);
    speakThen(ans ? ans.variants[0] : '', () => {
      if (!playingRef.current) return;
      // Stop at the lose → win boundary; wait for a space/Reveal press.
      const st2 = stateRef.current;
      if (st2.revealCount === st2.loseAnswers.length && st2.winAnswers.length > 0) {
        playingRef.current = false;
        setPlaying(false);
        return;
      }
      // otherwise a brief pause after speaking before the next one appears
      pauseRef.current = setTimeout(() => {
        if (playingRef.current) step();
      }, 300);
    });
  }, [speakThen]);

  const goto = useCallback(
    (index: number) => {
      const n = questions.length;
      playingRef.current = false;
      cancelSpeech();
      setPlaying(false);
      setRevealCount(0);
      stateRef.current.revealCount = 0;
      setQi(((index % n) + n) % n);
    },
    [questions.length, cancelSpeech]
  );

  const allRevealed = revealCount >= total;
  const atBoundary = !playing && revealCount > 0 && revealCount === loseAnswers.length && winAnswers.length > 0;

  // Primary action: start/pause the reveal, or move to the next question.
  const advance = useCallback(() => {
    if (allRevealed) {
      goto(qi + 1);
      return;
    }
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      cancelSpeech();
    } else {
      playingRef.current = true;
      setPlaying(true);
      step();
    }
  }, [allRevealed, goto, qi, step, cancelSpeech]);

  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        advanceRef.current();
      } else if (e.key === 'ArrowLeft') {
        goto(qi - 1);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [goto, qi]);

  // Pan the screen down as answers fill in, so the newest stays in view.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (revealCount === 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.scrollingElement || document.documentElement;
    window.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [revealCount]);

  // Stop speech if the component unmounts.
  useEffect(() => () => cancelSpeech(), [cancelSpeech]);

  let primaryLabel = 'Reveal ▸';
  if (allRevealed) primaryLabel = 'Next question ▸';
  else if (playing) primaryLabel = 'Pause';
  else if (revealCount > 0) primaryLabel = 'Resume ▸';

  return (
    <div className="flex flex-col overflow-x-hidden">
      <header className="flex items-center gap-4 px-6 py-4">
        <Link href={homeHref} className="text-sm font-semibold text-zinc-400 hover:text-white">
          ← {homeLabel}
        </Link>
        <div className="ml-auto flex items-center gap-2.5">
          <button
            onClick={() => {
              cancelSpeech();
              setMuted((m) => !m);
            }}
            title="Toggle sound"
            className="cursor-pointer text-lg"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={() => goto(qi - 1)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-semibold hover:border-zinc-600"
          >
            ◂ Prev
          </button>
          <span className="min-w-[70px] text-center text-sm tabular-nums text-zinc-400">
            {qi + 1} / {questions.length}
          </span>
          <button
            onClick={() => goto(qi + 1)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-semibold hover:border-zinc-600"
          >
            Next ▸
          </button>
        </div>
      </header>

      <div className="flex flex-col items-center px-5 pb-6 pt-2">
        <h1 className="mx-auto mb-1.5 mt-2.5 max-w-[1100px] text-center text-3xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl">
          {questions[qi].text}
        </h1>
        <p className="mb-6 text-center text-[15px] text-zinc-400">
          {name} wins by naming any <b className="font-bold text-green-400">{winLabel}</b> answer - one only
          a single person gave.
        </p>

        <div className="flex w-full max-w-[900px] flex-col gap-4">
          <Section
            title={loseLabel}
            subtitle="2+ people said these - no win"
            tone="lose"
            answers={loseAnswers}
            baseIndex={0}
            revealCount={revealCount}
          />
          <Section
            title={winLabel}
            subtitle="only one person said these - name any & everyone drinks"
            tone="win"
            answers={winAnswers}
            baseIndex={loseAnswers.length}
            revealCount={revealCount}
          />
          {revealCount === 0 && (
            <p className="mt-8 text-center text-zinc-500">
              Press <b className="text-white">Reveal ▸</b> below (or the <b className="text-white">space bar</b>) to
              start the board.
            </p>
          )}

          {atBoundary && (
            <p className="mt-6 text-center text-base font-bold text-green-400">
              {loseLabel} done - press <b className="text-white">space</b> (or Resume ▸) for the {winLabel}{' '}
              answers.
            </p>
          )}

          {allRevealed && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => announce('win')}
                className="flex-1 rounded-2xl border-2 border-green-500 bg-green-500/15 px-6 py-6 text-2xl font-black uppercase tracking-tight text-green-300 transition-colors hover:bg-green-500/25 sm:text-3xl"
              >
                {winLabel} 🍺
              </button>
              <button
                onClick={() => announce('lose')}
                className="flex-1 rounded-2xl border-2 border-rose-500 bg-rose-500/15 px-6 py-6 text-2xl font-black uppercase tracking-tight text-rose-300 transition-colors hover:bg-rose-500/25 sm:text-3xl"
              >
                {loseLabel} 💀
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Control bar */}
      <div className="sticky bottom-0 w-full border-t border-zinc-700 bg-zinc-900/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1100px] items-center gap-2.5">
          <span className="text-sm text-zinc-400">
            {allRevealed ? 'All revealed.' : `Revealed ${revealCount} / ${total}`}
          </span>
          <div className="ml-auto flex gap-2.5">
            <button
              onClick={() => {
                playingRef.current = false;
                setPlaying(false);
                setRevealCount(0);
                stateRef.current.revealCount = 0;
                cancelSpeech();
              }}
              disabled={revealCount === 0 && !playing}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base font-extrabold tracking-tight text-white hover:border-zinc-600 disabled:opacity-40"
            >
              Reset
            </button>
            <button
              onClick={advance}
              className="rounded-xl bg-white px-5 py-3 text-base font-extrabold tracking-tight text-black hover:bg-zinc-200"
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  tone,
  answers,
  baseIndex,
  revealCount,
}: {
  title: string;
  subtitle: string;
  tone: 'lose' | 'win';
  answers: Answer[];
  baseIndex: number;
  revealCount: number;
}) {
  const win = tone === 'win';
  // Only render revealed answers, so hidden rows don't reserve space.
  const revealed = Math.max(0, Math.min(answers.length, revealCount - baseIndex));
  if (revealed === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-3">
        <h2
          className={
            'text-xl font-black uppercase tracking-tight sm:text-2xl ' +
            (win ? 'text-green-400' : 'text-rose-400')
          }
        >
          {title}
        </h2>
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{subtitle}</span>
      </div>
      {answers.slice(0, revealed).map((a, j) => (
        <div
          key={j}
          className={
            'pop-in flex items-center gap-4 rounded-2xl border px-5 py-3.5 ' +
            (win ? 'border-green-500/45 bg-green-500/5' : 'border-zinc-700 bg-zinc-800')
          }
        >
          <div className="min-w-0 flex-1">
            <div className="text-lg font-black leading-tight tracking-tight sm:text-2xl">{a.variants[0]}</div>
            {a.variants.length > 1 && (
              <div className="mt-0.5 text-sm text-zinc-400">{a.variants.slice(1).join('  ·  ')}</div>
            )}
          </div>
          <span
            className={
              'shrink-0 font-mono text-2xl font-bold sm:text-3xl ' + (win ? 'text-green-400' : 'text-white')
            }
          >
            {a.votes}
          </span>
        </div>
      ))}
    </div>
  );
}
