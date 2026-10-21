// Deck analysis (README "Deck analysis"): pitch mix, cost curve and dimension totals.
// Weapons and equipment are "always available" and counted apart from cards that are drawn.
import type { Dimension } from "../scoring/scoreRepository.ts";
import { sectionOf, type DeckEntry } from "./deckRules.ts";

export type PitchCounts = Record<1 | 2 | 3 | 4, number>;

export interface DimensionTotal {
  key: string;
  label: string;
  /** Deck cards (copies) scoring above 0 */
  cards: number;
  byPitch: PitchCounts;
  /** Average score of those cards, 0–100 */
  average: number;
  /** Weapons and equipment in the loadout scoring above 0 */
  alwaysAvailable: number;
}

export interface DeckOverview {
  /** Deck cards (copies), not counting sideboard or gear */
  cards: number;
  /** Per card with a cost */
  averageCost: number;
  /** Per card with a pitch */
  averagePitch: number;
  /** Average pitch minus average cost: spare resources per card */
  resourceSurplus: number;
  goAgain: number;
  attacks: number;
}

export interface DeckAnalysis {
  overview: DeckOverview;
  pitch: PitchCounts;
  costCurve: Record<"0" | "1" | "2" | "3+", number>;
  dimensions: DimensionTotal[];
  /** Deck cards (copies) with no score yet */
  unscored: number;
}

const emptyPitch = (): PitchCounts => ({ 1: 0, 2: 0, 3: 0, 4: 0 });
const isPitch = (p: number | null): p is 1 | 2 | 3 | 4 =>
  p === 1 || p === 2 || p === 3 || p === 4;

export function analyseDeck(input: {
  entries: DeckEntry[];
  dimensions: Dimension[];
  /** variant id -> dimension key -> score */
  scores: Map<string, Record<string, number>>;
}): DeckAnalysis {
  const loadout = input.entries.filter((e) => !e.sideboard);
  const deck = loadout.filter((e) => sectionOf(e.card) === "deck");
  const gear = loadout.filter((e) => sectionOf(e.card) !== "deck");

  const pitch = emptyPitch();
  const costCurve = { "0": 0, "1": 0, "2": 0, "3+": 0 };
  let unscored = 0;
  for (const e of deck) {
    if (isPitch(e.variant.pitch)) pitch[e.variant.pitch] += e.quantity;
    const cost = e.variant.cost;
    if (cost !== null) {
      costCurve[cost >= 3 ? "3+" : (String(cost) as "0" | "1" | "2")] +=
        e.quantity;
    }
    if (!input.scores.has(e.variant.id)) unscored += e.quantity;
  }

  const dimensions = input.dimensions.map((d) => {
    const byPitch = emptyPitch();
    let cards = 0;
    let sum = 0;
    for (const e of deck) {
      const score = input.scores.get(e.variant.id)?.[d.key] ?? 0;
      if (score <= 0) continue;
      cards += e.quantity;
      sum += score * e.quantity;
      if (isPitch(e.variant.pitch)) byPitch[e.variant.pitch] += e.quantity;
    }
    const alwaysAvailable = gear
      .filter((e) => (input.scores.get(e.variant.id)?.[d.key] ?? 0) > 0)
      .reduce((n, e) => n + e.quantity, 0);
    return {
      key: d.key,
      label: d.label,
      cards,
      byPitch,
      average: cards === 0 ? 0 : Math.round(sum / cards),
      alwaysAvailable,
    };
  });

  return { overview: overviewOf(deck), pitch, costCurve, dimensions, unscored };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function overviewOf(deck: DeckEntry[]): DeckOverview {
  const average = (value: (e: DeckEntry) => number | null) => {
    let n = 0;
    let sum = 0;
    for (const e of deck) {
      const v = value(e);
      if (v === null) continue;
      n += e.quantity;
      sum += v * e.quantity;
    }
    return n === 0 ? 0 : sum / n;
  };
  const count = (test: (e: DeckEntry) => boolean) =>
    deck.filter(test).reduce((n, e) => n + e.quantity, 0);
  const cost = average((e) => e.variant.cost);
  const pitch = average((e) => e.variant.pitch);
  return {
    cards: count(() => true),
    averageCost: round2(cost),
    averagePitch: round2(pitch),
    resourceSurplus: round2(pitch - cost),
    goAgain: count((e) => !!e.card.attributes.hasGoAgain),
    attacks: count((e) => e.card.type === "attack_action"),
  };
}
