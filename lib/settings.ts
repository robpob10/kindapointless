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
  try {
    raw = await getSettings(GAME_ID);
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
    debug: `keys=${Object.keys(raw).join(',') || 'none'}; err=${debugError || 'none'}`,
  };
}
