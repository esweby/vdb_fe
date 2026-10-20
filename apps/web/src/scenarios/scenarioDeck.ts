// A deck as scenarios run it: the main deck drawn as built (no blanks: maintainer, 19 Oct 2026),
// weapons and equipment always visible, the sideboard left out. Goldfish expands the main
// deck in the same order, so a run's seed deals the same game there.
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";
import type { DeckCard } from "../decks/deckRepository.ts";
import { sectionOf, type DeckEntry } from "../decks/deckRules.ts";
import { engineCardOf } from "../ranking/scenarios.ts";
import type { DeckForScenarios } from "./ScenarioBuilder.tsx";

export function scenarioDeck(entries: DeckEntry[]): DeckForScenarios {
  const main = entries.filter((e) => !e.sideboard);
  const drawn = main.filter((e) => sectionOf(e.card) === "deck");
  const gear = main.filter((e) => sectionOf(e.card) !== "deck");
  return {
    core: drawn.map((e) => ({
      card: engineCardOf(e.card, e.variant),
      copies: e.quantity,
    })),
    gear: gear.flatMap((e) =>
      Array.from({ length: e.quantity }, () => engineCardOf(e.card, e.variant)),
    ),
    deckSize: drawn.reduce((n, e) => n + e.quantity, 0),
  };
}

/** A deck's cards with their card details, from the card pool. */
export function entriesOf(cards: DeckCard[], pool: CardSummary[]): DeckEntry[] {
  const byVariant = new Map<
    string,
    { card: CardSummary; variant: VariantSummary }
  >();
  for (const card of pool)
    for (const variant of card.variants)
      byVariant.set(variant.id, { card, variant });
  return cards.flatMap((c) => {
    const found = byVariant.get(c.variantId);
    return found
      ? [{ ...found, quantity: c.quantity, sideboard: c.sideboard }]
      : [];
  });
}
