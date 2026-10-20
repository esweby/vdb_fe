// Matchups, part 3: a plan's cards become the deck's main deck for goldfish and scenarios;
// whatever the plan boards out drops to the sideboard, so nothing leaves the pool.
import type { Matchup } from "./deckRepository.ts";
import { poolEntries, type DeckEntry } from "./deckRules.ts";

export function entriesForMatchup(
  entries: DeckEntry[],
  cards: Matchup["cards"],
): DeckEntry[] {
  const planned = new Map(cards.map((c) => [c.variantId, c.quantity]));
  const inPlan = (e: DeckEntry) => planned.get(e.variant.id) ?? 0;
  // A card split between the deck and the sideboard counts as one, its copies added up.
  const pool = poolEntries(entries);
  return [
    ...pool
      .filter((e) => inPlan(e) > 0)
      .map((e) => ({ ...e, quantity: inPlan(e), sideboard: false })),
    ...pool
      .filter((e) => e.quantity - inPlan(e) > 0)
      .map((e) => ({
        ...e,
        quantity: e.quantity - inPlan(e),
        sideboard: true,
      })),
  ];
}
