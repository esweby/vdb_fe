import { describe, expect, it } from "vitest";
import type { CardSummary } from "../cards/cardRepository.ts";
import { SOUL_OF_EXISTENCE } from "../test/fakeCardRepository.ts";
import {
  copyLimitFor,
  deckCounts,
  deckProblems,
  sectionOf,
  variantName,
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

describe("variantName", () => {
  it("names a purple card's pitch", () => {
    const soul = SOUL_OF_EXISTENCE;
    expect(variantName(soul, soul.variants[0]!)).toBe(
      "Soul of Existence (purple)",
    );
  });
});

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

  // Maintainer, 19 Oct 2026: many players run a 48–56 card main deck and keep the rest in the
  // sideboard, so the main deck is taken as built; only the pool is capped.
  it("accepts a main deck of any size, with the rest in the sideboard", () => {
    expect(
      deckProblems(
        [...filler(16), entry(card("Side"), 3, true), entry(helm, 1)],
        rules,
      ),
    ).toEqual([]);
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

  it("allows one copy of each piece of equipment (maintainer, 15 Oct 2026)", () => {
    expect(
      copyLimitFor(card("Face Purgatory", "equipment", ["Head"]), rules),
    ).toBe(1);
    // Weapons (maintainer, 16 Oct 2026): one of a two-handed weapon, two of a one-handed one.
    expect(copyLimitFor(sword, rules)).toBe(1);
    expect(copyLimitFor(scepter, rules)).toBe(2);
    expect(copyLimitFor(card("Hocus Pocus"), rules)).toBe(3);
    const purgatory = card("Face Purgatory", "equipment", ["Head"]);
    const noPitch = {
      ...purgatory,
      variants: [{ ...purgatory.variants[0]!, pitch: null }],
    };
    expect(
      deckProblems([...filler(20), entry(noPitch, 2, true)], rules),
    ).toEqual(["Face Purgatory has 2 copies; at most 1 is allowed."]);
  });

  // Legendary cards are one per deck (scoring group, 16 Oct 2026: Arknight Shard).
  it("allows one copy of a Legendary card", () => {
    const shard = {
      ...card("Arknight Shard", "resource"),
      keywords: ["Legendary"],
    };
    expect(copyLimitFor(shard, rules)).toBe(1);
    expect(deckProblems([...filler(20), entry(shard, 2)], rules)).toEqual([
      "Arknight Shard (red) has 2 copies; at most 1 is allowed.",
    ]);
  });

  it("counts a weapon's copies across the deck and the sideboard together", () => {
    expect(
      deckProblems(
        [...filler(20), entry(scepter, 1), entry(scepter, 2, true)],
        rules,
      ),
    ).toEqual(["Scepter (red) has 3 copies; at most 2 are allowed."]);
    expect(
      deckProblems(
        [...filler(20), entry(scepter, 1), entry(scepter, 1, true)],
        rules,
      ),
    ).toEqual([]);
    expect(
      deckProblems(
        [...filler(20), entry(sword, 1), entry(sword, 1, true)],
        rules,
      ),
    ).toEqual(["Sword (red) has 2 copies; at most 1 is allowed."]);
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
