// Matchups, part 3: a plan's cards become the deck's main deck for goldfish and scenarios;
// whatever the plan boards out drops to the sideboard, so nothing leaves the pool.
import type { Matchup } from "./deckRepository.ts";
import type { DeckEntry } from "./deckRules.ts";

export function entriesForMatchup(
  entries: DeckEntry[],
  cards: Matchup["cards"],
): DeckEntry[] {
  const planned = new Map(cards.map((c) => [c.variantId, c.quantity]));
  const inPlan = (e: DeckEntry) => planned.get(e.variant.id) ?? 0;
  return [
    ...entries
      .filter((e) => inPlan(e) > 0)
      .map((e) => ({ ...e, quantity: inPlan(e), sideboard: false })),
    ...entries
      .filter((e) => e.quantity - inPlan(e) > 0)
      .map((e) => ({
        ...e,
        quantity: e.quantity - inPlan(e),
        sideboard: true,
      })),
  ];
}
