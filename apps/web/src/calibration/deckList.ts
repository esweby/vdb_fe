// A plain deck list for engine calibration (docs/engine-calibration.md), read by the deck import's
// parser (decks/deckList.ts). Only the main deck is played, so the sideboard is dropped, and a
// line that can't be read stops the run.
import { readDeckList } from "../decks/deckList.ts";

export interface DeckListEntry {
  copies: number;
  name: string;
  pitch: number | null;
}

export function parseDeckList(text: string): DeckListEntry[] {
  const list = readDeckList(text);
  const main = list.cards.filter((c) => !c.sideboard);
  const firstSide = list.cards.find((c) => c.sideboard)?.line ?? Infinity;
  const bad = list.unreadable.find((l) => l.line < firstSide);
  if (bad)
    throw new Error(
      `Can't read line ${bad.line} of the deck list: "${bad.text}"`,
    );
  return main.map(({ copies, name, pitch }) => ({ copies, name, pitch }));
}
