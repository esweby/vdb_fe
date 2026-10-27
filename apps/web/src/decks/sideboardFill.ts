// An unfinished deck is measured as a full one, filled from its sideboard (the maintainer,
// 27 Oct 2026, over hidden recommendations). The fill is for the measurement only: it's never
// added to the deck or shown as part of it.
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";
import {
  copyLimitFor,
  sectionOf,
  type DeckEntry,
  type FormatRules,
} from "./deckRules.ts";

/**
 * A deck still being built is measured as a full one.
 *
 * UNVERIFIED: 60 cards is the usual Classic Constructed deck; for the maintainer to confirm.
 */
export const FULL_DECK = 60;

export interface MeasuredDeck {
  /** The deck's own cards and the sideboard copies filling it, one per card and pitch. */
  core: { card: CardSummary; variant: VariantSummary; copies: number }[];
  /** Sideboard copies used to fill the deck. */
  filled: number;
  /** Blanks for whatever the sideboard couldn't reach. */
  blanks: number;
  deckSize: number;
}

/**
 * The deck to measure: its own cards, then sideboard cards in the sideboard's own order up to
 * 60, each within its copy limit across the deck and the fill. A deck of 60 or more is
 * unchanged. Where the sideboard can't reach 60 the rest are blanks, and weapons and equipment
 * in the sideboard are left out, as they aren't drawn (both the maintainer, 27 Oct 2026).
 */
export function measuredDeck(
  entries: DeckEntry[],
  rules: FormatRules | null,
): MeasuredDeck {
  const drawn = (e: DeckEntry) => sectionOf(e.card) === "deck";
  const core = new Map<string, MeasuredDeck["core"][number]>();
  const add = (e: DeckEntry, copies: number) => {
    const seen = core.get(e.variant.id);
    if (seen) seen.copies += copies;
    else core.set(e.variant.id, { card: e.card, variant: e.variant, copies });
  };
  let size = 0;
  for (const e of entries.filter((e) => !e.sideboard && drawn(e))) {
    add(e, e.quantity);
    size += e.quantity;
  }
  let filled = 0;
  for (const e of entries.filter((e) => e.sideboard && drawn(e))) {
    const limit = rules ? copyLimitFor(e.card, rules) : Infinity;
    const room = limit - (core.get(e.variant.id)?.copies ?? 0);
    const copies = Math.min(e.quantity, room, FULL_DECK - size - filled);
    if (copies <= 0) continue;
    add(e, copies);
    filled += copies;
  }
  const deckSize = Math.max(FULL_DECK, size);
  return {
    core: [...core.values()],
    filled,
    blanks: deckSize - size - filled,
    deckSize,
  };
}
