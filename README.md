# Kinda Pointless 🍺

A **Next.js** web app for playing **Pointless** (with a twist) about a friend,
for their big day. Next.js 14 (App Router) + TypeScript + Tailwind, with
**Vercel Postgres** for storage.

Set who the game is about in [`lib/config.ts`](lib/config.ts) — change `NAME`
from the `<name>` placeholder and the whole site updates.

There are two phases.

## Phase 1 — Gather answers (`/collect`)

Attendees open the site before the day and answer questions about the subject.
For each question they can give **as many answers as they like**. Each answer is
stored as a `username | question | answer` row.

**The rules attendees see:**

1. Add as many answers as you want to each question.
2. On the day, the subject has to guess the answer the fewest of us gave
   (without landing on an answer nobody said). Lowest non-zero answer → we all
   drink; otherwise they drink.
3. Joke answers are allowed but may get pruned.

There are **no built-in questions** — attendees add their own on `/collect`.
Those are stored in Postgres (`custom_questions`). If you want some questions
from the start, add them to [`lib/questions.ts`](lib/questions.ts).

## Admin (`/admin`)

Everything on `/admin` is hidden until the admin key is entered.

- **Site settings** — set the subject's **name** (replaces the `<name>`
  placeholder everywhere), and the **win word** / **lose word** used on the
  boards (defaults: Win / Lose). Stored in Postgres; the site updates
  immediately. Empty fields fall back to the defaults.
- See how many answers are in, who's answered, and a live tally per question.
- **Download CSV / JSON.** Bucket similar answers together (e.g. "UK" =
  "Britain" = "Great Britain") and count the votes.
- **Danger zone: Clear database** — wipes the name, win/lose words, and all
  submitted answers (custom questions are kept). Deliberately hard to press by
  accident: it requires re-entering the admin key and pressing the button
  twice within 8 seconds.

## Phase 2 — Play on the day (`/play`)

Runs in the browser — great on a TV. It reads the bucketed answers from
[`lib/game.ts`](lib/game.ts).

**The rule:** the subject wins by naming any answer that only **one** person
submitted. So each question's board is split into two:

- **Lose** — buckets with 2+ submissions. Naming these does NOT win.
- **Win** — buckets with exactly 1 submission. Name any one → everyone drinks.

Hit **Reveal** (or **Space**) and the answers cascade in one at a time (press
again to pause/resume). You adjudicate the guess and the drinking live.

### The `game` data (`lib/game.ts`)

```ts
export const GAME: Game = {
  title: TITLE,
  questions: [
    {
      text: 'Name a country they have visited',
      answers: [
        // one bucket = one answer; `votes` = how many submitted it,
        // `variants` = the distinct wordings shown on screen.
        { variants: ['France', 'Fraaance'], votes: 6 },
        { variants: ['Peru'], votes: 1 },
      ],
    },
  ],
};
```

- `votes` = number of submissions in the bucket. 2+ → Lose, exactly 1 → Win.
- `variants` = the distinct wordings, shown together in one panel.

`lib/game.ts` ships **empty** — `/play` shows a placeholder until you fill it in
after bucketing the collected answers.

---

## Running locally

```bash
npm install
npm run dev
```

## Deploying (Vercel)

1. Import the repo into Vercel.
2. In **Storage → Create → Postgres**, connect it to the project. That injects the
   `POSTGRES_*` env vars (see `.env.local.example`). The `answers` table is created
   automatically on first write.
3. Deploy.

The `/admin` data export and reset are gated by a key, hardcoded to **`banana`**
(type it into the key box on `/admin`). Change it in `app/api/submit/route.ts` and
`app/api/submissions/route.ts` if you like.

> The **play** phase needs no database — it only reads `lib/game.ts`. Only
> `/collect` and `/admin` touch Postgres.
