import { sql } from '@vercel/postgres';
import { unstable_noStore as noStore } from 'next/cache';

export type AnswerRow = {
  username: string;
  question: string;
  answer: string;
  created_at?: string;
};

// All rows are namespaced by `game` so multiple games can share one database
// without their submissions mixing.

async function ensureTable() {
  noStore();
  await sql`
    CREATE TABLE IF NOT EXISTS answers (
      id         SERIAL PRIMARY KEY,
      game       VARCHAR(40) NOT NULL,
      username   VARCHAR(80) NOT NULL,
      question   TEXT        NOT NULL,
      answer     TEXT        NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS answers_game_user_q_a ON answers (game, username, question, answer)`;
}

export async function getAllAnswers(game: string): Promise<AnswerRow[]> {
  await ensureTable();
  const result = await sql<AnswerRow>`
    SELECT username, question, answer, created_at
    FROM answers
    WHERE game = ${game}
    ORDER BY created_at ASC
  `;
  return result.rows;
}

/** Insert many (username, question, answer) rows for a game. Dupes ignored. */
export async function addAnswers(
  game: string,
  username: string,
  items: { question: string; answer: string }[]
): Promise<number> {
  await ensureTable();
  let saved = 0;
  for (const it of items) {
    const question = (it.question || '').trim();
    const answer = (it.answer || '').trim();
    if (!question || !answer) continue;
    const res = await sql`
      INSERT INTO answers (game, username, question, answer)
      VALUES (${game}, ${username}, ${question}, ${answer})
      ON CONFLICT (game, username, question, answer) DO NOTHING
    `;
    saved += res.rowCount ?? 0;
  }
  return saved;
}

export async function clearAll(game: string): Promise<void> {
  await ensureTable();
  await sql`DELETE FROM answers WHERE game = ${game}`;
}

// ---- custom questions (added by attendees on /collect) ----

async function ensureQuestionsTable() {
  noStore();
  await sql`
    CREATE TABLE IF NOT EXISTS custom_questions (
      id         SERIAL PRIMARY KEY,
      game       VARCHAR(40) NOT NULL,
      text       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS custom_questions_game_text ON custom_questions (game, text)`;
}

export async function getCustomQuestions(game: string): Promise<string[]> {
  await ensureQuestionsTable();
  const r = await sql<{ text: string }>`
    SELECT text FROM custom_questions WHERE game = ${game} ORDER BY created_at ASC, id ASC
  `;
  return r.rows.map((x) => x.text);
}

export async function addQuestion(game: string, text: string): Promise<void> {
  await ensureQuestionsTable();
  await sql`
    INSERT INTO custom_questions (game, text) VALUES (${game}, ${text})
    ON CONFLICT (game, text) DO NOTHING
  `;
}

// ---- site settings (name, win word, lose word - set on /admin) ----

async function ensureSettingsTable() {
  noStore();
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      id    SERIAL PRIMARY KEY,
      game  VARCHAR(40) NOT NULL,
      key   VARCHAR(40) NOT NULL,
      value TEXT NOT NULL
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS settings_game_key ON settings (game, key)`;
}

export async function getSettings(game: string): Promise<Record<string, string>> {
  await ensureSettingsTable();
  const r = await sql<{ key: string; value: string }>`
    SELECT key, value FROM settings WHERE game = ${game}
  `;
  const out: Record<string, string> = {};
  for (const row of r.rows) out[row.key] = row.value;
  return out;
}

/** Upsert settings; an empty value deletes the row (reverting to the default). */
export async function setSettings(game: string, entries: Record<string, string>): Promise<void> {
  await ensureSettingsTable();
  for (const [key, raw] of Object.entries(entries)) {
    const value = (raw || '').trim();
    if (!value) {
      await sql`DELETE FROM settings WHERE game = ${game} AND key = ${key}`;
    } else {
      await sql`
        INSERT INTO settings (game, key, value) VALUES (${game}, ${key}, ${value})
        ON CONFLICT (game, key) DO UPDATE SET value = EXCLUDED.value
      `;
    }
  }
}

export async function clearSettings(game: string): Promise<void> {
  await ensureSettingsTable();
  await sql`DELETE FROM settings WHERE game = ${game}`;
}
