// The occasional synergy question (the maintainer, 20 Oct 2026): confirming links in a queue is
// too much effort, so one relevant link is asked at a time, small and out of the way, picked at
// random among the most preferred. Preference: a link touching a Usurp the Shadow Throne card,
// then one touching a Rune Gate card, then the two cards' average community rating.
import type { SynergyEdge } from "@vdb/cards";
import { pairKey } from "./synergyQueue.ts";

/** The newest set's cards come first (the maintainer: "new cards from IAR"). */
export const NEW_SET = "Usurp the Shadow Throne";

export interface NudgeCard {
  name: string;
  firstSet?: string | null;
  attributes: { hasRuneGate: boolean };
}

/** Unanswered links, most preferred first; with `focus`, only links touching that card. */
export function nudgeCandidates(
  edges: SynergyEdge[],
  cards: Map<string, NudgeCard>,
  answered: Set<string>,
  ratings: Map<string, number>,
  focus?: string,
): SynergyEdge[] {
  const either = (e: SynergyEdge, test: (c: NudgeCard) => boolean) => {
    const a = cards.get(e.from);
    const b = cards.get(e.to);
    return (!!a && test(a)) || (!!b && test(b));
  };
  const tier = (e: SynergyEdge) =>
    either(e, (c) => c.firstSet === NEW_SET)
      ? 0
      : either(e, (c) => c.attributes.hasRuneGate)
        ? 1
        : 2;
  const rating = (e: SynergyEdge) =>
    ((ratings.get(e.from) ?? 0) + (ratings.get(e.to) ?? 0)) / 2;
  const name = (id: string) => cards.get(id)?.name ?? id;
  return edges
    .filter((e) => !answered.has(pairKey(e.from, e.to)))
    .filter((e) => !focus || e.from === focus || e.to === focus)
    .sort(
      (a, b) =>
        tier(a) - tier(b) ||
        rating(b) - rating(a) ||
        name(a.from).localeCompare(name(b.from)) ||
        name(a.to).localeCompare(name(b.to)),
    );
}

/** One link at random among the `top` most preferred, or nothing to ask. */
export function pickNudge(
  candidates: SynergyEdge[],
  random: () => number = Math.random,
  top = 8,
): SynergyEdge | undefined {
  const pool = candidates.slice(0, top);
  if (pool.length === 0) return undefined;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
