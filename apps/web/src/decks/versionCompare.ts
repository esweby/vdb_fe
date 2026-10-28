// What changed between two lists: two saved versions, or a version and the deck as it is now.
// The deck and the sideboard are compared apart, so a copy moved across shows on both sides.
// (boardChanges in MatchupsPanel compares a plan with the main deck across the whole pool, so it
// doesn't fit here.)
import type { DeckSnapshot } from "./deckRepository.ts";
import { PITCH_NAMES, type DeckEntry } from "./deckRules.ts";

/** One row of a list: a card's copies in the deck, or in the sideboard. */
export interface ListCard {
  variantId: string;
  name: string;
  quantity: number;
  sideboard: boolean;
}

/** Copies before and after; 0 before is an added card, 0 after a removed one. */
export interface CardChange {
  variantId: string;
  name: string;
  from: number;
  to: number;
}

export function compareLists(
  from: ListCard[],
  to: ListCard[],
): { deck: CardChange[]; sideboard: CardChange[] } {
  const side = (sideboard: boolean) => {
    const changes = new Map<string, CardChange>();
    const add = (rows: ListCard[], key: "from" | "to") => {
      for (const row of rows) {
        if (row.sideboard !== sideboard) continue;
        const change = changes.get(row.variantId) ?? {
          variantId: row.variantId,
          name: row.name,
          from: 0,
          to: 0,
        };
        change[key] += row.quantity;
        // The newer name wins, in case the card data changed.
        if (key === "to") change.name = row.name;
        changes.set(row.variantId, change);
      }
    };
    add(from, "from");
    add(to, "to");
    return [...changes.values()]
      .filter((change) => change.from !== change.to)
      .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
  };
  return { deck: side(false), sideboard: side(true) };
}

/** A saved version's cards, named like the deck's (see variantName). */
export function snapshotCards(snapshot: DeckSnapshot): ListCard[] {
  return snapshot.cards.map((card) => {
    const pitch = card.pitch === null ? undefined : PITCH_NAMES[card.pitch];
    return {
      variantId: card.variantId,
      name: pitch ? `${card.name} (${pitch})` : card.name,
      quantity: card.quantity,
      sideboard: card.sideboard,
    };
  });
}

/** The deck's cards as they are now. */
export function entryCards(entries: DeckEntry[]): ListCard[] {
  return entries.map((entry) => {
    const pitch =
      entry.variant.pitch === null
        ? undefined
        : PITCH_NAMES[entry.variant.pitch];
    return {
      variantId: entry.variant.id,
      name: pitch ? `${entry.card.name} (${pitch})` : entry.card.name,
      quantity: entry.quantity,
      sideboard: entry.sideboard,
    };
  });
}
