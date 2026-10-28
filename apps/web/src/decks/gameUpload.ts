// Checking an uploaded Talishar game against a deck's versions (docs/test-loop.md, step 2).
import type { CardPlayStats } from "@vdb/talishar";
import type { DeckVersion } from "./deckRepository.ts";
import { PITCH_NAMES } from "./deckRules.ts";

const key = (name: string, pitch: number | null) => `${name}|${pitch ?? ""}`;

/**
 * The game's cards the version doesn't list (main deck or sideboard), as "Name (pitch)".
 * Talishar's export lists every card in the deck played, so any here suggest the game
 * was played with another version.
 */
export function missingFrom(
  cards: CardPlayStats[],
  version: DeckVersion,
): string[] {
  const listed = new Set(
    version.snapshot.cards.map((card) => key(card.name, card.pitch)),
  );
  return cards
    .filter((card) => !listed.has(key(card.name, card.pitch)))
    .map((card) => `${card.name} (${PITCH_NAMES[card.pitch]})`);
}

/** The newest version that has every card in the game, or null. */
export function bestVersion(
  cards: CardPlayStats[],
  versions: DeckVersion[],
): DeckVersion | null {
  return (
    [...versions]
      .sort((a, b) => b.number - a.number)
      .find((version) => missingFrom(cards, version).length === 0) ?? null
  );
}

/** "Version 3", or "Version 3 · Levia tech" when the owner named it. */
export function versionLabel(version: Pick<DeckVersion, "number" | "name">) {
  return version.name
    ? `Version ${version.number} · ${version.name}`
    : `Version ${version.number}`;
}
