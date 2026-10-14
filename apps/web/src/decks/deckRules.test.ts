import { describe, expect, it } from "vitest";
import type { CardSummary } from "../cards/cardRepository.ts";
import {
  deckCounts,
  deckProblems,
  sectionOf,
  type DeckEntry,
  type FormatRules,
} from "./deckRules.ts";

const rules: FormatRules = {
  copyLimit: 3,
  deckMin: 60,
  poolMax: 80,
  weaponHands: 2,
};

const card = (
  name: string,
  type = "action",
  subtypes: string[] = [],
): CardSummary => ({
  id: `card-${name}`,
  name,
  type,
  subtypes,
  classes: ["Runeblade"],
  talents: [],
  keywords: [],
  attributes: {} as CardSummary["attributes"],
  attributesVerified: true,
  variants: [
    {
      id: `${name}-1`,
      pitch: 1,
      cost: 0,
      power: null,
      defense: 3,
      attributes: {},
    },
  ],
});

const entry = (
  c: CardSummary,
  quantity: number,
  sideboard = false,
): DeckEntry => ({ card: c, variant: c.variants[0]!, quantity, sideboard });

/** n distinct deck cards, 3 copies each. */
const filler = (cards: number) =>
  Array.from({ length: cards }, (_, i) => entry(card(`Filler ${i}`), 3));

const sword = card("Sword", "weapon", ["Sword", "2H"]);
const scepter = card("Scepter", "weapon", ["Scepter", "1H"]);
const helm = card("Helm", "equipment", ["Head"]);
const crown = card("Crown", "equipment", ["Head"]);
const shield = card("Shield", "equipment", ["Off-Hand"]);

describe("sectionOf", () => {
  it("puts weapons and equipment apart from cards that are drawn", () => {
    expect(sectionOf(sword)).toBe("weapon");
    expect(sectionOf(helm)).toBe("equipment");
    expect(sectionOf(card("Attack", "attack_action"))).toBe("deck");
  });
});

describe("deckCounts", () => {
  it("counts the deck, the sideboard and the whole pool", () => {
    expect(
      deckCounts([
        entry(card("A"), 3),
        entry(card("B"), 2, true),
        entry(sword, 1),
        entry(helm, 1),
      ]),
    ).toEqual({ deck: 3, sideboard: 2, pool: 7 });
  });
});

describe("deckProblems", () => {
  it("accepts a legal deck", () => {
    expect(deckProblems([...filler(20), entry(sword, 1)], rules)).toEqual([]);
  });

  it("needs a minimum number of deck cards, not counting the sideboard or gear", () => {
    expect(
      deckProblems(
        [...filler(19), entry(card("Side"), 3, true), entry(helm, 1)],
        rules,
      ),
    ).toEqual(["The deck has 57 cards; it needs at least 60."]);
  });

  it("caps the whole pool, including the sideboard and gear", () => {
    expect(
      deckProblems(
        [...filler(26), entry(card("Side"), 3, true), entry(helm, 1)],
        rules,
      ),
    ).toEqual(["The card pool has 82 cards; at most 80 are allowed."]);
  });

  it("limits copies of each card and pitch", () => {
    expect(
      deckProblems([...filler(20), entry(card("Extra"), 4)], rules),
    ).toEqual(["Extra (red) has 4 copies; at most 3 are allowed."]);
  });

  it("allows one piece of equipment per slot in the loadout, but more in the sideboard", () => {
    expect(
      deckProblems(
        [...filler(20), entry(helm, 1), entry(crown, 1, true)],
        rules,
      ),
    ).toEqual([]);
    expect(
      deckProblems([...filler(20), entry(helm, 1), entry(crown, 1)], rules),
    ).toEqual(["The loadout has 2 Head pieces; only one per slot."]);
  });

  it("limits the hands weapons and off-hand equipment use", () => {
    expect(
      deckProblems([...filler(20), entry(scepter, 1), entry(shield, 1)], rules),
    ).toEqual([]);
    expect(
      deckProblems([...filler(20), entry(sword, 1), entry(shield, 1)], rules),
    ).toEqual([
      "The loadout's weapons and off-hand need 3 hands; there are only 2.",
    ]);
  });
});
