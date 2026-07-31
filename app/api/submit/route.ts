import { NextRequest, NextResponse } from 'next/server';
import { addAnswers, clearAll } from '@/lib/db';
import { GAME_ID } from '@/lib/config';

export const dynamic = 'force-dynamic';

import { ADMIN_KEY } from '@/lib/adminKey';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = (body.username || '').trim();
    if (!username) {
      return NextResponse.json({ error: 'username required' }, { status: 400 });
    }

    let items: { question: string; answer: string }[] = Array.isArray(body.items) ? body.items : [];
    if (!items.length && (body.question || body.answer)) {
      items = [{ question: body.question, answer: body.answer }];
    }
    items = items.filter((it) => it && String(it.question).trim() && String(it.answer).trim());
    if (!items.length) {
      return NextResponse.json({ error: 'no answers provided' }, { status: 400 });
    }

    const saved = await addAnswers(GAME_ID, username, items);
    return NextResponse.json({ ok: true, saved });
  } catch (err) {
    console.error('[POST /api/submit]', err);
    return NextResponse.json(
      {
        error: 'Storage error',
        hint: 'Add a Vercel Postgres store in Vercel → Storage and connect it to this project, then redeploy.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const key = (req.nextUrl.searchParams.get('key') || '').trim();
  if (key !== ADMIN_KEY) {
    return NextResponse.json({ error: 'bad admin key' }, { status: 401 });
  }
  try {
    await clearAll(GAME_ID);
    return NextResponse.json({ ok: true, cleared: true });
  } catch (err) {
    console.error('[DELETE /api/submit]', err);
    return NextResponse.json({ error: 'Storage error' }, { status: 500 });
  }
}
