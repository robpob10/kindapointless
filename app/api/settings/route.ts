import { NextRequest, NextResponse } from 'next/server';
import { getSettings, setSettings } from '@/lib/db';
import { GAME_ID, NAME } from '@/lib/config';
import { ADMIN_KEY } from '@/lib/adminKey';

export const dynamic = 'force-dynamic';

function shape(raw: Record<string, string>) {
  const name = (raw.name || '').trim() || NAME;
  return {
    raw: {
      name: raw.name || '',
      winWord: raw.win_word || '',
      loseWord: raw.lose_word || '',
    },
    effective: {
      name,
      winWord: (raw.win_word || '').trim() || 'Win',
      loseWord: (raw.lose_word || '').trim() || 'Lose',
      title: `${name} Pointless`,
    },
  };
}

// Admin only: current settings (also doubles as the admin-key check).
export async function GET(req: NextRequest) {
  const key = (req.nextUrl.searchParams.get('key') || '').trim();
  if (key !== ADMIN_KEY) {
    return NextResponse.json({ error: 'bad admin key' }, { status: 401 });
  }
  const headers = { 'Cache-Control': 'no-store' };
  try {
    return NextResponse.json({ ok: true, ...shape(await getSettings(GAME_ID)) }, { headers });
  } catch {
    // Storage not configured yet — key is still valid, serve defaults.
    return NextResponse.json(
      {
        ok: true,
        ...shape({}),
        hint: 'Add a Vercel Postgres store in Vercel → Storage and connect it to this project, then redeploy.',
      },
      { headers }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if ((body.key || '').trim() !== ADMIN_KEY) {
      return NextResponse.json({ error: 'bad admin key' }, { status: 401 });
    }
    const name = String(body.name ?? '').trim();
    const winWord = String(body.winWord ?? '').trim();
    const loseWord = String(body.loseWord ?? '').trim();
    if (name.length > 60 || winWord.length > 40 || loseWord.length > 40) {
      return NextResponse.json({ error: 'value too long' }, { status: 400 });
    }
    await setSettings(GAME_ID, { name, win_word: winWord, lose_word: loseWord });
    return NextResponse.json({ ok: true, ...shape(await getSettings(GAME_ID)) });
  } catch (err) {
    console.error('[POST /api/settings]', err);
    return NextResponse.json(
      {
        error: 'Storage error',
        hint: 'Add a Vercel Postgres store in Vercel → Storage and connect it to this project, then redeploy.',
      },
      { status: 500 }
    );
  }
}
