// Deck list import (the maintainer, 27 Oct 2026): every line is matched to a card by name and
// pitch. A line that doesn't match is listed so the player can fix or remove it, and the import
// waits until none are left. Deck rules aren't checked here: a list imports as given, and the
// deck page flags its problems.
import type { CardSummary } from "../cards/cardRepository.ts";
import type { DeckCard } from "./deckRepository.ts";
import type { DeckList } from "./deckList.ts";
import { PITCH_NAMES } from "./deckRules.ts";

export interface UnmatchedLine {
  line: number;
  text: string;
  reason: string;
}

export interface MatchedList {
  /** One row per card, pitch and side: repeated lines are added up. */
  cards: DeckCard[];
  unmatched: UnmatchedLine[];
  /** Why the list's hero can't be imported, or null. */
  hero: string | null;
  /** Every line matched, the hero is Viserai or not named, and there's at least one card. */
  ready: boolean;
}

const normal = (name: string) =>
  name.normalize("NFC").replace(/[‘’]/g, "'").trim().toLowerCase();

const listed = (words: string[]) =>
  words.length < 2
    ? words.join("")
    : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;

export function matchDeckList(
  list: DeckList,
  cards: readonly CardSummary[],
): MatchedList {
  const byName = new Map(cards.map((c) => [normal(c.name), c]));
  const rows = new Map<string, DeckCard>();
  const unmatched: UnmatchedLine[] = list.unreadable.map((l) => ({
    ...l,
    reason: "Can't read this line.",
  }));
  for (const entry of list.cards) {
    const card = byName.get(normal(entry.name));
    const variant = card?.variants.find((v) => v.pitch === entry.pitch);
    if (!card || !variant) {
      unmatched.push({
        line: entry.line,
        text: entry.text,
        reason: !card
          ? "No card with this name."
          : pitchHint(card, entry.pitch !== null),
      });
      continue;
    }
    const key = `${variant.id}:${entry.sideboard}`;
    const seen = rows.get(key);
    rows.set(key, {
      variantId: variant.id,
      quantity: (seen?.quantity ?? 0) + entry.copies,
      sideboard: entry.sideboard,
    });
  }
  unmatched.sort((a, b) => a.line - b.line);
  const hero = heroProblem(list.hero);
  return {
    cards: [...rows.values()],
    unmatched,
    hero,
    ready: unmatched.length === 0 && hero === null && rows.size > 0,
  };
}

function pitchHint(card: CardSummary, coloured: boolean) {
  const colours = card.variants
    .map((v) => v.pitch)
    .filter((p): p is number => p !== null)
    .sort()
    .map((p) => PITCH_NAMES[p] ?? String(p));
  return colours.length === 0
    ? `${card.name} has no pitch colour. Take the colour off.`
    : `${card.name} comes in ${listed([...new Set(colours)])}. ${coloured ? "Change" : "Add"} the colour.`;
}

/**
 * Every deck here is Viserai's, so a list for another hero can't be imported, for a new deck or a
 * replaced pool (the maintainer, 27 Oct 2026). Null for Viserai, or when the list names no hero.
 */
export function heroProblem(hero: string | null): string | null {
  if (!hero || /^viserai\b/i.test(hero.trim())) return null;
  return `This list is for ${hero}. This app builds Viserai decks only.`;
}

/** The text without one of its lines (numbered from 1). */
export function removeLine(text: string, line: number): string {
  const lines = text.split("\n");
  lines.splice(line - 1, 1);
  return lines.join("\n");
}
