// Checking an uploaded Talishar game against a deck version (docs/test-loop.md, step 2).
import type { CardPlayStats } from "@vdb/talishar";
import type { DeckVersion } from "./deckRepository.ts";
import { PITCH_NAMES } from "./deckRules.ts";

const key = (name: string, pitch: number | null) => `${name}|${pitch ?? ""}`;

/** The game's cards the version doesn't list, as "Name (pitch)". */
function missingFrom(cards: CardPlayStats[], version: DeckVersion): string[] {
  const listed = new Set(
    version.snapshot.cards.map((card) => key(card.name, card.pitch)),
  );
  return cards
    .filter((card) => !listed.has(key(card.name, card.pitch)))
    .map((card) => `${card.name} (${PITCH_NAMES[card.pitch]})`);
}

/**
 * Talishar's export lists every card in the deck it was played with. A card the chosen
 * version doesn't have (main deck or sideboard) means the game may belong elsewhere:
 * `fits` is the newest other version that has them all, or null.
 */
export function checkGame(
  cards: CardPlayStats[],
  version: DeckVersion,
  versions: DeckVersion[],
): { missing: string[]; fits: DeckVersion | null } {
  const missing = missingFrom(cards, version);
  if (missing.length === 0) return { missing, fits: null };
  const fits =
    [...versions]
      .sort((a, b) => b.number - a.number)
      .find(
        (other) =>
          other.id !== version.id && missingFrom(cards, other).length === 0,
      ) ?? null;
  return { missing, fits };
}
