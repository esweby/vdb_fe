// Rates from FaBlazing sums, with the plan's guardrails (docs/fablazing-plan.md, step 3): a
// number needs MIN_GAMES games, and every rate carries a Wilson interval. These describe
// associations in real games, never causes.
import type { CardStat, MatchupStat } from "./fablazingRepository.ts";

/** The fewest games before a number is shown. */
export const MIN_GAMES = 50;

/** The Wilson score interval for wins out of games, at 95% by default. */
export function wilson(
  wins: number,
  games: number,
  z = 1.96,
): { low: number; high: number } {
  if (games === 0) return { low: 0, high: 1 };
  const p = wins / games;
  const z2 = z * z;
  const denominator = 1 + z2 / games;
  const centre = (p + z2 / (2 * games)) / denominator;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / games + z2 / (4 * games * games))) /
    denominator;
  return {
    low: Math.max(0, centre - margin),
    high: Math.min(1, centre + margin),
  };
}

/** "34% (±9)": the rate, and half the width of its interval, in points. */
export function formatRate(wins: number, games: number): string {
  const { low, high } = wilson(wins, games);
  return `${Math.round((wins / games) * 100)}% (±${Math.round(((high - low) / 2) * 100)})`;
}

/** The interval in full, e.g. for a tooltip: "25–44%". */
export function formatInterval(wins: number, games: number): string {
  const { low, high } = wilson(wins, games);
  return `${Math.round(low * 100)}–${Math.round(high * 100)}%`;
}

export interface Rate {
  wins: number;
  games: number;
}

export function cardEvidence(s: CardStat) {
  const games = s.resultDecks;
  return {
    games,
    enough: games >= MIN_GAMES,
    /** Share of Viserai's decks that include it. */
    inclusion: s.baseDecks ? s.decks / s.baseDecks : 0,
    /** Copies in the decks that include it. */
    averageCopies: s.decks ? s.copies / s.decks : 0,
    playsPerGame: games ? s.played / games : 0,
    pitchesPerGame: games ? s.pitched / games : 0,
    blocksPerGame: games ? s.blocked / games : 0,
    hitsPerPlay: s.played ? s.hits / s.played : null,
    winRate: { wins: s.wins, games } as Rate,
    baseline: { wins: s.baseWins, games: s.baseResultDecks } as Rate,
  };
}

export function matchupEvidence(m: MatchupStat) {
  return {
    enough: m.games >= MIN_GAMES,
    winRate: { wins: m.wins, games: m.games } as Rate,
    metaShare: m.totalGames ? m.games / m.totalGames : 0,
  };
}

/** By our card id: plays of any of its pitches per Viserai game (every game, not only those with the card). */
export function playsPerViseraiGame(stats: CardStat[]): Map<string, number> {
  const plays = new Map<string, number>();
  for (const s of stats) {
    if (!s.cardId || !s.baseResultDecks) continue;
    plays.set(
      s.cardId,
      (plays.get(s.cardId) ?? 0) + s.played / s.baseResultDecks,
    );
  }
  return plays;
}

// Fixed month names, so every browser writes the same thing ("Sep", not "Sept").
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const parts = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y!, month: MONTHS[m! - 1]!, day: d! };
};

/** "30 Oct 2026". */
export function formatDay(iso: string): string {
  const p = parts(iso);
  return `${p.day} ${p.month} ${p.year}`;
}

/** "1–30 Oct 2026", or "25 Sep – 21 Oct 2026" across months. */
export function formatWindow(startsOn: string, latest: string): string {
  const a = parts(startsOn);
  const b = parts(latest);
  if (a.year !== b.year) return `${formatDay(startsOn)} – ${formatDay(latest)}`;
  if (a.month !== b.month) return `${a.day} ${a.month} – ${formatDay(latest)}`;
  return `${a.day}–${formatDay(latest)}`;
}

/** A FaBlazing hero id the map doesn't know, readably: "fang_dragonbound" → "Fang Dragonbound". */
export const heroFromSlug = (slug: string) =>
  slug
    .split("_")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
