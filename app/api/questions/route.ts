import { NextRequest, NextResponse } from 'next/server';
import { getCustomQuestions, addQuestion, getAnswerCounts } from '@/lib/db';
import { QUESTIONS } from '@/lib/questions';
import { GAME_ID } from '@/lib/config';

export const dynamic = 'force-dynamic';

// Base questions (from code) first, then custom ones (from Postgres), deduped.
function merge(custom: string[]): string[] {
  const seen = new Set(QUESTIONS.map((q) => q.toLowerCase()));
  const out = [...QUESTIONS];
  for (const c of custom) {
    const key = c.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

// Most-answered questions first, so the best ones lead the collect page.
// Ties keep their original order (sort is stable).
function byPopularity(questions: string[], counts: Record<string, number>): string[] {
  return [...questions].sort(
    (a, b) => (counts[b.trim().toLowerCase()] || 0) - (counts[a.trim().toLowerCase()] || 0)
  );
}

async function sortedQuestions(): Promise<string[]> {
  const custom = await getCustomQuestions(GAME_ID);
  let counts: Record<string, number> = {};
  try {
    counts = await getAnswerCounts(GAME_ID);
  } catch {
    /* fall back to unsorted */
  }
  return byPopularity(merge(custom), counts);
}

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    return NextResponse.json({ questions: await sortedQuestions() }, { headers });
  } catch {
    // If storage isn't configured yet, still serve the base questions.
    return NextResponse.json({ questions: QUESTIONS }, { headers });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const t = (body.text || '').trim();
    if (!t) return NextResponse.json({ error: 'question text required' }, { status: 400 });
    if (t.length > 200) return NextResponse.json({ error: 'question too long' }, { status: 400 });

    await addQuestion(GAME_ID, t);
    return NextResponse.json({ ok: true, questions: await sortedQuestions() });
  } catch (err) {
    console.error('[POST /api/questions]', err);
    return NextResponse.json(
      {
        error: 'Storage error',
        hint: 'Add a Vercel Postgres store in Vercel → Storage and connect it to this project, then redeploy.',
      },
      { status: 500 }
    );
  }
}
