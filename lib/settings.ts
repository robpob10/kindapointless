import { unstable_noStore as noStore } from 'next/cache';
import { getSettings } from './db';
import { GAME_ID, NAME } from './config';

export type SiteSettings = {
  name: string;
  winWord: string;
  loseWord: string;
  title: string;
};

// Effective settings for the site: overrides from Postgres, falling back to
// the defaults in lib/config.ts. Never throws — pages must render even when
// storage isn't configured yet.
export async function getSiteSettings(): Promise<SiteSettings> {
  noStore();
  let raw: Record<string, string> = {};
  try {
    raw = await getSettings(GAME_ID);
  } catch (err) {
    console.error('[getSiteSettings]', err);
  }
  const name = (raw.name || '').trim() || NAME;
  return {
    name,
    winWord: (raw.win_word || '').trim() || 'Win',
    loseWord: (raw.lose_word || '').trim() || 'Lose',
    title: `${name} Pointless`,
  };
}
