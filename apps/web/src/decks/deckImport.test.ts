// Deck list import (the maintainer, 27 Oct 2026): cards are matched by name and pitch, and the
// import waits until every line matches or is removed.
import { describe, expect, it } from "vitest";
import type { CardSummary } from "../cards/cardRepository.ts";
import { heroWarning, matchDeckList, removeLine } from "./deckImport.ts";
import { readDeckList } from "./deckList.ts";

const variant = (id: string, pitch: number | null) => ({
  id,
  pitch,
  cost: 0,
  power: null,
  defense: null,
  attributes: {},
});
const card = (name: string, variants: ReturnType<typeof variant>[]) =>
  ({
    id: name,
    name,
    type: "action",
    subtypes: [],
    classes: [],
    talents: [],
    keywords: [],
    attributes: {},
    attributesVerified: false,
    variants,
  }) as unknown as CardSummary;

const CARDS = [
  card("Hocus Pocus", [
    variant("hp1", 1),
    variant("hp2", 2),
    variant("hp3", 3),
  ]),
  card("Nebula Blade", [variant("nb", null)]),
  card("Fyendal's Spring Tunic", [variant("tunic", null)]),
];

const match = (text: string) => matchDeckList(readDeckList(text), CARDS);

describe("matchDeckList", () => {
  it("matches by name and pitch, ignoring case", () => {
    expect(match("3x hocus pocus (Red)\n1 Nebula Blade").cards).toEqual([
      { variantId: "hp1", quantity: 3, sideboard: false },
      { variantId: "nb", quantity: 1, sideboard: false },
    ]);
  });

  it("keeps the sideboard apart, and adds up repeated lines", () => {
    expect(
      match(
        "2 Hocus Pocus (red)\n1 Hocus Pocus (red)\nSideboard\n1 Hocus Pocus (red)",
      ).cards,
    ).toEqual([
      { variantId: "hp1", quantity: 3, sideboard: false },
      { variantId: "hp1", quantity: 1, sideboard: true },
    ]);
  });

  it("treats a curly apostrophe as a straight one", () => {
    expect(match("1 Fyendal’s Spring Tunic").cards).toEqual([
      { variantId: "tunic", quantity: 1, sideboard: false },
    ]);
  });

  it("lists a name it doesn't know", () => {
    const result = match("3 Hocus Pocus (red)\n2 Hokus Pokus (red)");
    expect(result.cards).toHaveLength(1);
    expect(result.unmatched).toEqual([
      {
        line: 2,
        text: "2 Hokus Pokus (red)",
        reason: "No card with this name.",
      },
    ]);
  });

  it("lists a known name with a pitch it doesn't come in", () => {
    expect(match("3 Hocus Pocus").unmatched).toEqual([
      {
        line: 1,
        text: "3 Hocus Pocus",
        reason: "Hocus Pocus comes in red, yellow and blue. Add the colour.",
      },
    ]);
    expect(match("1 Nebula Blade (red)").unmatched[0]?.reason).toBe(
      "Nebula Blade has no pitch colour. Take the colour off.",
    );
  });

  it("lists lines it can't read", () => {
    expect(match("Hocus Pocus x3").unmatched).toEqual([
      { line: 1, text: "Hocus Pocus x3", reason: "Can't read this line." },
    ]);
  });

  it("is ready only when every line matches", () => {
    expect(match("3 Hocus Pocus (red)").ready).toBe(true);
    expect(match("3 Hocus Pocus (red)\n1 Nope").ready).toBe(false);
    expect(match("").ready).toBe(false);
  });
});

describe("removeLine", () => {
  it("takes one line out of the text, so the list can go ahead without it", () => {
    const text = "3 Hocus Pocus (red)\n1 Nope\n1 Nebula Blade";
    const next = removeLine(text, 2);
    expect(next).toBe("3 Hocus Pocus (red)\n1 Nebula Blade");
    expect(matchDeckList(readDeckList(next), CARDS).ready).toBe(true);
  });
});

// Every deck here is Viserai's (DeckPage's HERO). A list for another hero still imports, with a
// warning (the maintainer's call on how to handle a hero line is pending).
describe("heroWarning", () => {
  it("says nothing for Viserai, or when the list names no hero", () => {
    expect(heroWarning(null)).toBeNull();
    expect(heroWarning("Viserai")).toBeNull();
    expect(heroWarning("Viserai, the Forsaken")).toBeNull();
  });

  it("warns when the list is for another hero", () => {
    expect(heroWarning("Dorinthea Ironsong")).toBe(
      "This list is for Dorinthea Ironsong. Decks here are Viserai's, so it imports as a Viserai deck.",
    );
  });
});
