// The deck-search spike (docs/deck-search-spike.md): a hill climb over decks of verified cards,
// each scored by goldfish turns played while holding blockers back. UNVERIFIED: the blocking
// model, the score and the pilot are Claude's draft for the maintainer to check.
import {
  DEFAULT_LINE_SCORE_SETTINGS,
  moveCard,
  pickLine,
  replayLine,
  searchTurn,
  setUp,
  type LineScoreSettings,
  type RulesCard,
  type RulesSetup,
  type TurnSearchOptions,
} from "@esweby/fab-engine/rules";
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";
import { copyLimitFor, variantName } from "../decks/deckRules.ts";
import { rulesCardOf } from "../scenarios/rulesCards.ts";

/** A card and pitch the search may use: verified rules only, so nothing scores by a gap. */
export interface PoolEntry {
  key: string;
  label: string;
  card: RulesCard;
  limit: number;
}

/** Copies by pool key. */
export type DeckCounts = Map<string, number>;

const COPY_LIMIT = 3;

export function poolOf(
  cards: CardSummary[],
  rulesOf: (
    card: CardSummary,
    variant: VariantSummary,
  ) => RulesCard = rulesCardOf,
): PoolEntry[] {
  const pool: PoolEntry[] = [];
  for (const card of cards) {
    if (card.type === "weapon" || card.type === "equipment") continue;
    for (const variant of card.variants) {
      const rules = rulesOf(card, variant);
      if (rules.effects === undefined) continue;
      pool.push({
        key: variant.id,
        label: variantName(card, variant),
        card: rules,
        limit: copyLimitFor(card, {
          copyLimit: COPY_LIMIT,
          deckMin: 0,
          poolMax: Infinity,
          weaponHands: 2,
        }),
      });
    }
  }
  return pool;
}

export function deckCards(deck: DeckCounts, pool: PoolEntry[]): RulesCard[] {
  const byKey = new Map(pool.map((e) => [e.key, e]));
  return [...deck].flatMap(([key, copies]) => {
    const e = byKey.get(key);
    if (!e) throw new Error(`${key} isn't in the pool.`);
    return Array.from({ length: copies }, () => e.card);
  });
}

/** mulberry32: small and seedable, so a seed gives the same swaps every time. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const same = (a: DeckCounts, b: DeckCounts) =>
  a.size === b.size && [...a].every(([k, n]) => b.get(k) === n);

/** `swaps` single-copy swaps: one copy out, one copy of another pool card in. */
export function mutate(
  deck: DeckCounts,
  pool: PoolEntry[],
  seed: number,
  swaps: number,
): DeckCounts {
  const rng = random(seed);
  const pick = <T>(xs: T[]) => xs[Math.floor(rng() * xs.length)]!;
  for (;;) {
    const next = new Map(deck);
    for (let i = 0; i < swaps; i++) {
      const out = pick([...next.keys()]);
      const room = pool.filter(
        (e) => e.key !== out && (next.get(e.key) ?? 0) < e.limit,
      );
      if (!room.length) continue;
      const left = next.get(out)! - 1;
      if (left) next.set(out, left);
      else next.delete(out);
      const add = pick(room);
      next.set(add.key, (next.get(add.key) ?? 0) + 1);
    }
    if (!same(next, deck)) return next;
  }
}

/** Adds `count` random copies within the limits: for random starts and unverified gaps. */
export function fill(
  deck: DeckCounts,
  pool: PoolEntry[],
  seed: number,
  count: number,
): DeckCounts {
  const rng = random(seed);
  const next = new Map(deck);
  for (let i = 0; i < count; i++) {
    const room = pool.filter((e) => (next.get(e.key) ?? 0) < e.limit);
    if (!room.length) throw new Error("The pool has no room for more copies.");
    const add = room[Math.floor(rng() * room.length)]!;
    next.set(add.key, (next.get(add.key) ?? 0) + 1);
  }
  return next;
}

export interface HeldTurn {
  threatened: number;
  /** Hand cards the turn left unused: spent blocking, so they don't carry into the next hand. */
  held: number;
  handAtStart: number;
  /** The line couldn't be replayed once the blockers had gone; its own result is used. */
  replayFailed: boolean;
}

export interface HoldBackOptions {
  turns: number;
  holdBack: number;
  settings?: LineScoreSettings;
  search?: TurnSearchOptions;
}

/**
 * Goldfish turns where each turn must leave `holdBack` hand cards unused. The unused cards stand
 * for the blockers spent on the opponent's turn, so they go to the graveyard and the turn is
 * replayed without them: the next hand is drawn up to intellect, not topped up around them.
 * The pilot is the engine's line picker (UNVERIFIED default weights).
 */
export function playHoldingBack(
  setup: Omit<RulesSetup, "seed">,
  seed: number,
  options: HoldBackOptions,
): HeldTurn[] {
  const settings = {
    ...(options.settings ?? DEFAULT_LINE_SCORE_SETTINGS),
    holdBack: options.holdBack,
  };
  let state = setUp({ ...setup, seed });
  const turns: HeldTurn[] = [];
  for (let t = 0; t < options.turns; t++) {
    const start = state;
    const line = pickLine(searchTurn(start, options.search).lines, settings);
    const after = new Set(line.state.zones.hand.map((c) => c.uid));
    const held = start.zones.hand.filter((c) => after.has(c.uid));
    let threatened = line.threatened,
      replayFailed = false;
    state = line.state;
    if (held.length) {
      let spent = start;
      for (const c of held) spent = moveCard(spent, c.uid, "graveyard");
      try {
        const replayed = replayLine(spent, line.actions);
        threatened = replayed.threatened;
        state = replayed.state;
      } catch {
        replayFailed = true;
        for (const c of held) state = moveCard(state, c.uid, "graveyard");
      }
    }
    turns.push({
      threatened,
      held: held.length,
      handAtStart: start.zones.hand.length,
      replayFailed,
    });
  }
  return turns;
}

/** UNVERIFIED thresholds, as elsewhere: brick under 5, burst 9+, big 14+. */
export const BRICK_UNDER = 5;
export const BURST_AT = 9;
export const BIG_AT = 14;
const BONUS = 4;

/** Each turn scores its threat plus 4 for a burst and 4 more for a big turn, averaged. */
export function summarise(games: { threatened: number }[][]) {
  const turns = games.flat();
  const share = (f: (n: number) => boolean) =>
    turns.filter((t) => f(t.threatened)).length / turns.length;
  const mean = (f: (n: number) => number) =>
    turns.reduce((s, t) => s + f(t.threatened), 0) / turns.length;
  return {
    turns: turns.length,
    meanThreatened: mean((n) => n),
    brick: share((n) => n < BRICK_UNDER),
    burst: share((n) => n >= BURST_AT),
    big: share((n) => n >= BIG_AT),
    score: mean(
      (n) => n + (n >= BURST_AT ? BONUS : 0) + (n >= BIG_AT ? BONUS : 0),
    ),
  };
}

export interface ClimbOptions {
  steps: number;
  seed: number;
  /** Most single-copy swaps per step (default 3). */
  maxSwaps?: number;
  /** How much a swap must beat the best by to be kept, so noise isn't kept (default 0). */
  margin?: number;
  onStep?: (step: number, score: number, accepted: boolean) => void;
}

/** A hill climb: try a few swaps, keep the deck only if it scores higher. */
export async function climb(
  start: DeckCounts,
  pool: PoolEntry[],
  evaluate: (deck: DeckCounts) => Promise<number>,
  options: ClimbOptions,
) {
  const rng = random(options.seed);
  let best = start,
    score = await evaluate(start);
  const history = [{ step: 0, score, deck: start }];
  for (let step = 1; step <= options.steps; step++) {
    const swaps = 1 + Math.floor(rng() * (options.maxSwaps ?? 3));
    const candidate = mutate(best, pool, Math.floor(rng() * 2 ** 31), swaps);
    const s = await evaluate(candidate);
    const accepted = s > score + (options.margin ?? 0);
    if (accepted) {
      best = candidate;
      score = s;
      history.push({ step, score, deck: candidate });
    }
    options.onStep?.(step, s, accepted);
  }
  return { best, score, history };
}
