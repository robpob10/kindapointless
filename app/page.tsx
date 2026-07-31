import Link from 'next/link';
import HomeRules from '@/components/HomeRules';
import { NAME } from '@/lib/config';

export default function Home() {
  return (
    <main className="flex min-h-screen justify-center px-8 pb-10 pt-12 sm:pt-16">
      <div className="relative z-10 w-full max-w-[560px]">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-400">
          {NAME}&apos;s Stag Do
        </p>
        <h1 className="mb-8 mt-2 text-6xl font-black leading-[0.92] tracking-tight sm:text-7xl">
          {NAME}
          <br />
          Pointless
        </h1>

        <div className="flex flex-col gap-2.5">
          <Link
            href="/play"
            className="rounded-2xl bg-white px-5 py-4 text-black transition-colors hover:bg-zinc-200"
          >
            <h2 className="text-lg font-black tracking-tight">Play the game →</h2>
            <p className="text-sm text-black/55">
              The main event — dramatic reveals on the big screen. Use this on the stag.
            </p>
          </Link>
          <Link
            href="/collect"
            className="rounded-2xl border border-zinc-700 bg-zinc-800 px-5 py-4 transition-colors hover:border-zinc-600"
          >
            <h2 className="text-lg font-black tracking-tight">Submit answers</h2>
            <p className="text-sm text-zinc-400">
              Answer the questions about {NAME} before the day. As many answers as you like.
            </p>
          </Link>
          <Link
            href="/admin"
            className="rounded-2xl border border-zinc-700 bg-zinc-800 px-5 py-4 transition-colors hover:border-zinc-600"
          >
            <h2 className="text-lg font-black tracking-tight">Admin</h2>
            <p className="text-sm text-zinc-400">
              See how many answers are in and download the dataset for bucketing.
            </p>
          </Link>
        </div>

        <HomeRules />
      </div>
    </main>
  );
}
