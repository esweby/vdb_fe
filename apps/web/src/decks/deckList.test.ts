// Deck list import: a pasted or uploaded list read into lines, before any card is matched.
import { describe, expect, it } from "vitest";
import { readDeckList } from "./deckList.ts";

// The shape of FaBrary's text export, written from memory of it: UNVERIFIED until checked
// against a real export.
const FABRARY = `Name: Viserai test
Hero: Viserai
Format: Classic Constructed

Arena cards
1x Nebula Blade
1x Grasp of Darkness

Deck cards
3x Hocus Pocus (red)
2x Become the Shadow Lord (blue)

Sideboard
1x Sigil of Suffering (yellow)

See the full deck @ https://fabrary.net/decks/01ABC
Made with ❤️ at the FaBrary`;

describe("readDeckList", () => {
  it("reads plain lines with or without an x", () => {
    expect(
      readDeckList("3x Hocus Pocus (red)\n3 Hocus Pocus (Blue)").cards,
    ).toEqual([
      {
        line: 1,
        text: "3x Hocus Pocus (red)",
        copies: 3,
        name: "Hocus Pocus",
        pitch: 1,
        sideboard: false,
      },
      {
        line: 2,
        text: "3 Hocus Pocus (Blue)",
        copies: 3,
        name: "Hocus Pocus",
        pitch: 3,
        sideboard: false,
      },
    ]);
  });

  it("reads cards without a pitch", () => {
    expect(readDeckList("1 Nebula Blade").cards[0]).toMatchObject({
      name: "Nebula Blade",
      pitch: null,
    });
  });

  it("puts lines after a Sideboard heading in the sideboard", () => {
    const { cards } = readDeckList(
      "3 Hocus Pocus (red)\nSideboard\n2 Hocus Pocus (blue)",
    );
    expect(cards.map((c) => [c.name, c.pitch, c.sideboard])).toEqual([
      ["Hocus Pocus", 1, false],
      ["Hocus Pocus", 3, true],
    ]);
  });

  it("reads a FaBrary export: hero, name, arena and deck cards, sideboard", () => {
    const list = readDeckList(FABRARY);
    expect(list.hero).toBe("Viserai");
    expect(list.name).toBe("Viserai test");
    expect(list.unreadable).toEqual([]);
    expect(
      list.cards.map((c) => [c.copies, c.name, c.pitch, c.sideboard]),
    ).toEqual([
      [1, "Nebula Blade", null, false],
      [1, "Grasp of Darkness", null, false],
      [3, "Hocus Pocus", 1, false],
      [2, "Become the Shadow Lord", 3, false],
      [1, "Sigil of Suffering", 2, true],
    ]);
  });

  it("keeps lines it can't read, with their line number", () => {
    const list = readDeckList("3 Hocus Pocus (red)\nHocus Pocus x3 red\n");
    expect(list.cards).toHaveLength(1);
    expect(list.unreadable).toEqual([{ line: 2, text: "Hocus Pocus x3 red" }]);
  });

  it("skips blank lines, comments and Windows line endings", () => {
    const list = readDeckList("# mine\r\n\r\n2 Hocus Pocus (yellow)\r\n");
    expect(list.unreadable).toEqual([]);
    expect(list.cards[0]).toMatchObject({ name: "Hocus Pocus", pitch: 2 });
  });

  it("reads a CSV with a header row, quoted names and a sideboard column", () => {
    const list = readDeckList(
      'Quantity,Name,Pitch,Sideboard\n3,Hocus Pocus,red,no\n1,"Viserai, the Forsaken",,\n2,Hocus Pocus,blue,yes',
    );
    expect(list.unreadable).toEqual([]);
    expect(
      list.cards.map((c) => [c.copies, c.name, c.pitch, c.sideboard]),
    ).toEqual([
      [3, "Hocus Pocus", 1, false],
      [1, "Viserai, the Forsaken", null, false],
      [2, "Hocus Pocus", 3, true],
    ]);
  });
});
