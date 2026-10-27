// An unfinished deck is measured filled from its sideboard (maintainer, 27 Oct 2026): the
// sideboard's own order, copy limits still apply, never over 60, blanks for what's left.
import { describe, expect, it } from "vitest";
import type { CardSummary } from "../cards/cardRepository.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { sampleRules } from "../test/fakeDeckRepository.ts";
import type { DeckEntry } from "./deckRules.ts";
import { measuredDeck } from "./sideboardFill.ts";

const hocus = sampleCards[0]!;
const nebula = sampleCards.find((c) => c.name === "Nebula Blade")!;
/** A card of its own, so each test can name as many as it needs. */
const card = (name: string): CardSummary => ({
  ...hocus,
  id: `card-${name}`,
  name,
  variants: [{ ...hocus.variants[0]!, id: name }],
});
const main = (c: CardSummary, quantity: number): DeckEntry => ({
  card: c,
  variant: c.variants[0]!,
  quantity,
  sideboard: false,
});
const side = (c: CardSummary, quantity: number): DeckEntry => ({
  ...main(c, quantity),
  sideboard: true,
});
const copies = (m: ReturnType<typeof measuredDeck>) =>
  Object.fromEntries(m.core.map((c) => [c.variant.id, c.copies]));

const filler = card("filler");
const [a, b, c] = [card("a"), card("b"), card("c")];

describe("measuring an unfinished deck filled from its sideboard", () => {
  it("fills in the sideboard's own order", () => {
    const m = measuredDeck(
      [main(filler, 54), side(b, 3), side(a, 3), side(c, 3)],
      sampleRules,
    );
    expect(copies(m)).toEqual({ filler: 54, b: 3, a: 3 });
    expect(m.filled).toBe(6);
  });

  it("keeps each card within its copy limit across the deck and the fill", () => {
    // Three copies of a card is the limit: two in the deck leaves room for one more.
    const m = measuredDeck(
      [main(filler, 50), main(a, 2), side(a, 3), side(b, 3)],
      sampleRules,
    );
    expect(copies(m)).toEqual({ filler: 50, a: 3, b: 3 });
    expect(m.filled).toBe(4);
  });

  it("never fills past 60", () => {
    const m = measuredDeck(
      [main(filler, 58), side(a, 3), side(b, 3)],
      sampleRules,
    );
    expect(copies(m)).toEqual({ filler: 58, a: 2 });
    expect(m.deckSize).toBe(60);
  });

  it("leaves a deck of 60 or more as it is", () => {
    for (const size of [60, 62]) {
      const m = measuredDeck([main(filler, size), side(a, 3)], sampleRules);
      expect(copies(m)).toEqual({ filler: size });
      expect(m.filled).toBe(0);
      expect(m.deckSize).toBe(size);
    }
  });

  it("pads with blanks when the sideboard can't reach 60", () => {
    const m = measuredDeck(
      [main(filler, 40), side(a, 3), side(b, 2)],
      sampleRules,
    );
    expect(copies(m)).toEqual({ filler: 40, a: 3, b: 2 });
    expect(m.filled).toBe(5);
    expect(m.blanks).toBe(15);
    expect(m.deckSize).toBe(60);
  });

  it("puts the filled cards in as cards, not blanks", () => {
    const m = measuredDeck([main(filler, 59), side(a, 3)], sampleRules);
    expect(m.core.find((c) => c.variant.id === "a")).toMatchObject({
      card: a,
      copies: 1,
    });
    expect(m.blanks).toBe(0);
  });

  it("doesn't fill with weapons or equipment from the sideboard", () => {
    const m = measuredDeck(
      [main(filler, 59), side(nebula, 1), side(a, 3)],
      sampleRules,
    );
    expect(copies(m)).toEqual({ filler: 59, a: 1 });
  });
});
