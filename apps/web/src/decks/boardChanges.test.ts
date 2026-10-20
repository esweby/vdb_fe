// Matchups: in and out against the main deck, with a card split between the deck and the
// sideboard (the maintainer, 20 Oct 2026).
import { describe, expect, it } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { poolEntries, type DeckEntry } from "./deckRules.ts";
import { boardChanges } from "./MatchupsPanel.tsx";

const hocus = sampleCards.find((c) => c.name === "Hocus Pocus")!;
const red = (quantity: number, sideboard: boolean): DeckEntry => ({
  card: hocus,
  variant: hocus.variants[0]!,
  quantity,
  sideboard,
});

describe("a split card in a matchup", () => {
  it("is one card in the pool, with its copies added up", () => {
    expect(
      poolEntries([red(1, false), red(2, true)]).map((e) => [
        e.variant.id,
        e.quantity,
      ]),
    ).toEqual([[hocus.variants[0]!.id, 3]]);
  });

  it("boards in from its sideboard copies once, against its deck copies", () => {
    const plan = new Map([[hocus.variants[0]!.id, 3]]);
    expect(boardChanges([red(1, false), red(2, true)], plan)).toEqual([
      { name: "Hocus Pocus (red)", delta: 2 },
    ]);
  });
});
