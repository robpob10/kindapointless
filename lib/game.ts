import { TITLE } from './config';

// The bucketed answers for the PLAY phase (/play), built from the collected
// submissions. Each answer is a bucket: `votes` = how many people submitted it,
// `variants` = the distinct wordings shown on screen within that one panel.
//
// Rules: the subject WINS by naming any answer only ONE person submitted.
//   - Lose = buckets with 2+ submissions (naming these does NOT win)
//   - Win  = buckets with exactly 1 submission (name any → everyone drinks)
//
// This ships empty. After the collect phase, download the data from /admin,
// bucket similar answers together, and fill in the questions below.

export type Answer = { variants: string[]; votes: number };
export type Question = { text: string; answers: Answer[] };
export type Game = { title: string; questions: Question[] };

export const GAME: Game = {
  title: TITLE,
  questions: [],
};
