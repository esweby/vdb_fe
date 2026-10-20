// Gaps (README "Deck analysis", phase two step 3): a maker role the deck relies on, missing
// from a pitch the deck plays. The thresholds are UNVERIFIED, for the maintainer to tune.
import { describe, expect, it } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { PITCH_NAMES, type DeckEntry } from "./deckRules.ts";
import { fillersFor, findGaps } from "./gaps.ts";

const [hocus, bsl, fate, nebula] = sampleCards;
const entry = (
  card: typeof hocus,
  variantId: string,
  quantity: number,
  sideboard = false,
): DeckEntry => ({
  card: card!,
  variant: card!.variants.find((v) => v.id === variantId)!,
  quantity,
  sideboard,
});

// Hocus Pocus makes Runechants; Become the Shadow Lord makes Runechants and Gates and
// banishes from hand; Fate Foreseen does neither.
const deck = [
  entry(hocus, "hp1", 3), // red Runechant maker
  entry(bsl, "bsl3", 3), // blue Runechant and Gate maker, hand banisher
  entry(fate, "ff1", 2), // red
  entry(fate, "ff2", 3), // yellow
  entry(fate, "ff3", 2), // blue
  entry(nebula, "nb", 1), // a weapon: not in the deck's pitches
];

describe("findGaps", () => {
  it("finds a role the deck relies on that's missing from a pitch it plays", () => {
    // Red: 5 cards, yellow 3, blue 5. Runechant makers 6, Gate makers 3, banishers 3.
    expect(
      findGaps(deck).map(
        (g) =>
          `${g.role.id} ${PITCH_NAMES[g.pitch]} ${g.roleCopies} ${g.pitchCopies}`,
      ),
    ).toEqual(["banish red 3 5"]);
  });

  // The maintainer, 20 Oct 2026: "Order gaps by red".
  it("lists red gaps first, then yellow, then blue; most-used roles first within a colour", () => {
    // Red 5 cards, yellow 5, blue 3. Runechant makers 6 (red and blue), Gate makers and
    // banishers 3 (blue only).
    const gaps = findGaps([
      entry(hocus, "hp1", 3),
      entry(bsl, "bsl3", 3),
      entry(fate, "ff1", 2),
      entry(fate, "ff2", 5),
    ]);
    expect(gaps.map((g) => `${g.role.id} ${PITCH_NAMES[g.pitch]}`)).toEqual([
      "banish red",
      "runechant yellow",
      "banish yellow",
    ]);
  });

  // The maintainer, 20 Oct 2026: "Not every colour needs a Gate maker". Gate makers are one pool,
  // never a gap in a colour.
  it("never flags Gate makers by colour", () => {
    expect(findGaps(deck).some((g) => g.role.id === "gate")).toBe(false);
  });

  it("ignores pitches the deck barely plays, and roles it barely uses", () => {
    // Yellow has only 3 cards; nothing here has go again.
    const gaps = findGaps(deck);
    expect(gaps.some((g) => g.pitch === 2)).toBe(false);
    expect(gaps.some((g) => g.role.id === "tempo")).toBe(false);
  });

  it("leaves out the sideboard", () => {
    const withSideboard = deck.map((e) =>
      e.card.id === "card-become-the-shadow-lord"
        ? { ...e, sideboard: true }
        : e,
    );
    expect(findGaps(withSideboard)).toEqual([]);
  });

  it("is empty for an empty deck", () => {
    expect(findGaps([])).toEqual([]);
  });
});

describe("fillersFor", () => {
  const values = new Map([
    ["hp2", 40],
    ["hp3", 30],
  ]);

  it("lists cards in the pool that would fill the gap, best rated first, not already in the deck", () => {
    const [gap] = findGaps([
      entry(hocus, "hp3", 3),
      entry(fate, "ff2", 5),
      entry(fate, "ff3", 2),
    ]);
    // Runechant makers in blue only; yellow has 5 cards and none.
    expect(gap).toMatchObject({ role: { id: "runechant" }, pitch: 2 });
    expect(
      fillersFor(gap!, sampleCards, values, new Set(["hp3"])).map(
        (f) => f.variant.id,
      ),
    ).toEqual(["hp2"]);
  });

  it("is empty when nothing in the pool fills it", () => {
    const [gate] = findGaps(deck);
    expect(fillersFor(gate!, sampleCards, values, new Set())).toEqual([]);
  });
});
