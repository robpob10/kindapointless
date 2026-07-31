import { sql } from '@vercel/postgres';
import { getSettings } from './db';
import { GAME_ID, NAME } from './config';

export type SiteSettings = {
  name: string;
  winWord: string;
  loseWord: string;
  title: string;
  debug: string;
};

// Effective settings for the site: overrides from Postgres, falling back to
// the defaults in lib/config.ts. Never throws — pages must render even when
// storage isn't configured yet.
export async function getSiteSettings(): Promise<SiteSettings> {
  let raw: Record<string, string> = {};
  let debugError: string | undefined;
  let nAll = -1;
  let curDb = '?';
  try {
    raw = await getSettings(GAME_ID);
    const info = await sql`SELECT count(*)::int AS n, current_database() AS db, current_schema() AS sch FROM settings`;
    nAll = info.rows[0]?.n ?? -2;
    const all = await sql`SELECT game, key, value FROM settings`;
    curDb = `${info.rows[0]?.db}/${info.rows[0]?.sch}; gameId=[${GAME_ID}]; rows=${JSON.stringify(all.rows)}`;
  } catch (err) {
    debugError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error('[getSiteSettings]', err);
  }
  const name = (raw.name || '').trim() || NAME;
  return {
    name,
    winWord: (raw.win_word || '').trim() || 'Win',
    loseWord: (raw.lose_word || '').trim() || 'Lose',
    title: `${name} Pointless`,
    debug: `ts=${new Date().toISOString()}; keys=${Object.keys(raw).join(',') || 'none'}; nAll=${nAll}; cur=${curDb}; err=${debugError || 'none'}; db=${dbTarget()}`,
  };
}

// Temporary diagnostics: which Postgres host/db does this context see?
export function dbTarget(): string {
  const url = process.env.POSTGRES_URL || '';
  const vars = ['POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL']
    .filter((k) => !!process.env[k])
    .join('+');
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname} vars=${vars || 'NONE'}`;
  } catch {
    return `unparseable vars=${vars || 'NONE'}`;
  }
}
