// Matchups, part 3: a plan's cards become the deck's main deck for goldfish and scenarios;
// whatever it boards out drops to the sideboard.
import { describe, expect, it } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import type { DeckEntry } from "./deckRules.ts";
import { entriesForMatchup } from "./matchupEntries.ts";

const entry = (
  name: string,
  variant: number,
  quantity: number,
  sideboard = false,
): DeckEntry => {
  const card = sampleCards.find((c) => c.name === name)!;
  return { card, variant: card.variants[variant]!, quantity, sideboard };
};

describe("entriesForMatchup", () => {
  it("plays the plan's cards as the main deck, the rest in the sideboard", () => {
    const entries = [
      entry("Hocus Pocus", 0, 3),
      entry("Become the Shadow Lord", 0, 2),
      entry("Fate Foreseen", 0, 2, true),
    ];
    const hp = entries[0]!.variant.id;
    const bsl = entries[1]!.variant.id;
    const ff = entries[2]!.variant.id;
    const played = entriesForMatchup(entries, [
      { variantId: hp, quantity: 2 },
      { variantId: bsl, quantity: 2 },
      { variantId: ff, quantity: 1 },
    ]);
    expect(played.map((e) => [e.variant.id, e.quantity, e.sideboard])).toEqual([
      [hp, 2, false],
      [bsl, 2, false],
      [ff, 1, false],
      [hp, 1, true],
      [ff, 1, true],
    ]);
  });

  // The maintainer, 20 Oct 2026: a card can be split between the deck and the sideboard.
  it("counts a split card's deck and sideboard copies together", () => {
    const entries = [
      entry("Hocus Pocus", 0, 1),
      entry("Hocus Pocus", 0, 2, true),
    ];
    const hp = entries[0]!.variant.id;
    const played = entriesForMatchup(entries, [{ variantId: hp, quantity: 2 }]);
    expect(played.map((e) => [e.variant.id, e.quantity, e.sideboard])).toEqual([
      [hp, 2, false],
      [hp, 1, true],
    ]);
  });
});
