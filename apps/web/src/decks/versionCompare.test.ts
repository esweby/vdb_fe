// Comparing two saved versions, or a version with the deck as it is now: cards added, removed
// and changed in quantity, with the deck and the sideboard kept apart (task 7b).
import { describe, expect, it } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import type { DeckSnapshot } from "./deckRepository.ts";
import type { DeckEntry } from "./deckRules.ts";
import {
  compareLists,
  entryCards,
  snapshotCards,
  type ListCard,
} from "./versionCompare.ts";

const card = (
  variantId: string,
  name: string,
  quantity: number,
  sideboard = false,
): ListCard => ({ variantId, name, quantity, sideboard });

describe("comparing two lists", () => {
  it("lists a card that is only in the newer list as added", () => {
    expect(compareLists([], [card("hp1", "Hocus Pocus (red)", 2)])).toEqual({
      deck: [{ variantId: "hp1", name: "Hocus Pocus (red)", from: 0, to: 2 }],
      sideboard: [],
    });
  });

  it("lists a card that is only in the older list as removed", () => {
    expect(compareLists([card("hp1", "Hocus Pocus (red)", 3)], [])).toEqual({
      deck: [{ variantId: "hp1", name: "Hocus Pocus (red)", from: 3, to: 0 }],
      sideboard: [],
    });
  });

  it("lists a card whose copies changed, with both quantities", () => {
    expect(
      compareLists(
        [card("hp1", "Hocus Pocus (red)", 2)],
        [card("hp1", "Hocus Pocus (red)", 3)],
      ).deck,
    ).toEqual([
      { variantId: "hp1", name: "Hocus Pocus (red)", from: 2, to: 3 },
    ]);
  });

  it("leaves out cards that did not change", () => {
    expect(
      compareLists(
        [
          card("hp1", "Hocus Pocus (red)", 3),
          card("ff1", "Fate Foreseen (red)", 1, true),
        ],
        [
          card("hp1", "Hocus Pocus (red)", 3),
          card("ff1", "Fate Foreseen (red)", 1, true),
        ],
      ),
    ).toEqual({ deck: [], sideboard: [] });
  });

  it("keeps the deck and the sideboard apart", () => {
    // One copy moved from the deck to the sideboard.
    expect(
      compareLists(
        [card("hp1", "Hocus Pocus (red)", 3)],
        [
          card("hp1", "Hocus Pocus (red)", 2),
          card("hp1", "Hocus Pocus (red)", 1, true),
        ],
      ),
    ).toEqual({
      deck: [{ variantId: "hp1", name: "Hocus Pocus (red)", from: 3, to: 2 }],
      sideboard: [
        { variantId: "hp1", name: "Hocus Pocus (red)", from: 0, to: 1 },
      ],
    });
  });

  it("sorts each side by name", () => {
    expect(
      compareLists(
        [],
        [
          card("hp1", "Hocus Pocus (red)", 1),
          card("ff1", "Fate Foreseen (red)", 1),
        ],
      ).deck.map((change) => change.name),
    ).toEqual(["Fate Foreseen (red)", "Hocus Pocus (red)"]);
  });
});

describe("a version against the deck as it is now", () => {
  const hocus = sampleCards.find((c) => c.name === "Hocus Pocus")!;
  const snapshot: DeckSnapshot = {
    schemaVersion: 1,
    name: "Gate tempo",
    hero: "Viserai, the Forsaken",
    format: "Classic Constructed",
    pitchTargets: {},
    cards: [
      {
        variantId: "hp1",
        quantity: 2,
        sideboard: false,
        externalId: "x",
        name: "Hocus Pocus",
        pitch: 1,
        type: "attack_action",
        subtypes: ["Attack"],
      },
    ],
    loadouts: [],
  };
  const now: DeckEntry[] = [
    { card: hocus, variant: hocus.variants[0]!, quantity: 3, sideboard: false },
  ];

  it("names a saved card the same way as a card in the deck", () => {
    expect(snapshotCards(snapshot)).toEqual([
      card("hp1", "Hocus Pocus (red)", 2),
    ]);
    expect(entryCards(now)).toEqual([card("hp1", "Hocus Pocus (red)", 3)]);
  });

  it("shows what changed since the version", () => {
    expect(compareLists(snapshotCards(snapshot), entryCards(now)).deck).toEqual(
      [{ variantId: "hp1", name: "Hocus Pocus (red)", from: 2, to: 3 }],
    );
  });
});
