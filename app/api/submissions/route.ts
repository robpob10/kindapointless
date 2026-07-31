import { NextRequest, NextResponse } from 'next/server';
import { getAllAnswers } from '@/lib/db';
import { GAME_ID } from '@/lib/config';

export const dynamic = 'force-dynamic';

const ADMIN_KEY = 'banana';

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export async function GET(req: NextRequest) {
  const key = (req.nextUrl.searchParams.get('key') || '').trim();
  if (key !== ADMIN_KEY) {
    return NextResponse.json({ error: 'bad admin key' }, { status: 401 });
  }

  try {
    const raw = await getAllAnswers(GAME_ID);
    // collapse duplicate (username, question, answer) triples
    const seen = new Set<string>();
    const rows = raw
      .map((r) => ({
        username: r.username,
        question: r.question,
        answer: r.answer,
        timestamp: r.created_at ?? '',
      }))
      .filter((r) => {
        const k = r.username + ' | ' + r.question + ' | ' + r.answer.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

    const format = (req.nextUrl.searchParams.get('format') || 'json').toLowerCase();
    if (format === 'csv') {
      const lines = ['username,question,answer,timestamp'];
      for (const r of rows) {
        lines.push([r.username, r.question, r.answer, r.timestamp].map(csvCell).join(','));
      }
      return new NextResponse(lines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${GAME_ID}-pointless.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({ count: rows.length, rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[GET /api/submissions]', err);
    return NextResponse.json({ error: 'Storage error' }, { status: 500 });
  }
}
