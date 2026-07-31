import { NextRequest, NextResponse } from 'next/server';
import { clearAll, clearSettings } from '@/lib/db';
import { GAME_ID } from '@/lib/config';
import { ADMIN_KEY } from '@/lib/adminKey';

export const dynamic = 'force-dynamic';

// Danger zone: wipes the name / win word / lose word settings and every
// submitted answer. Gated by the admin key; the UI double-confirms first.
export async function DELETE(req: NextRequest) {
  const key = (req.nextUrl.searchParams.get('key') || '').trim();
  if (key !== ADMIN_KEY) {
    return NextResponse.json({ error: 'bad admin key' }, { status: 401 });
  }
  try {
    await clearAll(GAME_ID);
    await clearSettings(GAME_ID);
    return NextResponse.json({ ok: true, cleared: true });
  } catch (err) {
    console.error('[DELETE /api/reset]', err);
    return NextResponse.json({ error: 'Storage error' }, { status: 500 });
  }
}
