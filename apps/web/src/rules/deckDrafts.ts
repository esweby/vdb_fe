// The effect drafts for one deck (main deck and sideboard), so one real deck can play by verified
// rules before the rest of the pool.
import { verifiedRulesFor } from "@vdb/engine/rules";
import type { CardSummary } from "../cards/cardRepository.ts";
import type { DeckCard } from "../decks/deckRepository.ts";

export interface DeckDrafts {
  /** The deck's cards, each once however many copies or pitches it has. */
  cardIds: Set<string>;
  total: number;
  /** Cards with verified rules for every pitch the deck plays of them. */
  verified: number;
}

export function deckDrafts(
  cards: readonly CardSummary[],
  deckCards: readonly DeckCard[],
): DeckDrafts {
  const byVariant = new Map(
    cards.flatMap((card) =>
      card.variants.map((v) => [v.id, { card, v }] as const),
    ),
  );
  const pitches = new Map<
    string,
    { card: CardSummary; pitches: Set<number | null> }
  >();
  for (const row of deckCards) {
    const found = byVariant.get(row.variantId);
    if (!found) continue;
    const entry = pitches.get(found.card.id) ?? {
      card: found.card,
      pitches: new Set(),
    };
    entry.pitches.add(found.v.pitch);
    pitches.set(found.card.id, entry);
  }
  const verified = [...pitches.values()].filter(({ card, pitches }) =>
    [...pitches].every((p) => verifiedRulesFor(card.name, p) !== undefined),
  ).length;
  return { cardIds: new Set(pitches.keys()), total: pitches.size, verified };
}
