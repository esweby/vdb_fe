// Scoping the effect drafts to one deck (main deck and sideboard), so one real deck can play by
// verified rules first.
import { describe, expect, it } from "vitest";
import type { CardSummary } from "../cards/cardRepository.ts";
import { sampleCards, TEST_POCUS } from "../test/fakeCardRepository.ts";
import { deckDrafts } from "./deckDrafts.ts";
import { draftQueue, missingFeatures } from "./draftQueue.ts";

const POOL: CardSummary[] = [...sampleCards, TEST_POCUS];
const hp = sampleCards[0]!;
const nothing: CardSummary = {
  ...hp,
  id: "card-nothing",
  name: "Nothing Test",
  variants: [
    {
      ...hp.variants[0]!,
      id: "nt1",
      attributes: {
        tokens: [{ token: "runechant", amount: "X", trigger: "on_play" }],
      },
    },
  ],
};

describe("deckDrafts", () => {
  it("finds the deck's cards, main deck and sideboard, each counted once", () => {
    const deck = deckDrafts(
      [...POOL, nothing],
      [
        { variantId: "tp1", quantity: 2, sideboard: false },
        { variantId: "tp1", quantity: 1, sideboard: true },
        { variantId: "tp2", quantity: 3, sideboard: false },
        { variantId: "bsl3", quantity: 1, sideboard: true },
        { variantId: "nt1", quantity: 3, sideboard: false },
      ],
    );
    expect([...deck.cardIds].sort()).toEqual([
      "card-become-the-shadow-lord",
      "card-nothing",
      "card-test-pocus",
    ]);
    expect(deck.total).toBe(3);
    expect(deck.verified).toBe(1);
  });

  it("ignores rows whose card isn't in the pool", () => {
    const deck = deckDrafts(POOL, [
      { variantId: "gone", quantity: 1, sideboard: false },
      { variantId: "hp1", quantity: 1, sideboard: false },
    ]);
    expect(deck).toEqual({
      cardIds: new Set(["card-hocus-pocus"]),
      total: 1,
      verified: 1,
    });
  });
});

describe("missingFeatures over partly drafted cards", () => {
  it("counts the gaps of partly drafted cards too when asked", () => {
    const partial: CardSummary = {
      ...hp,
      id: "card-partial",
      name: "Partial Test",
      variants: [
        {
          ...hp.variants[0]!,
          attributes: {
            tokens: [
              { token: "runechant", amount: 1, trigger: "on_attack" },
              { token: "runechant", amount: "X", trigger: "on_play" },
            ],
          },
        },
      ],
    };
    const queue = draftQueue([nothing, partial]);
    expect(queue.map((e) => e.status)).toEqual(["partial", "undraftable"]);
    expect(missingFeatures(queue)).toEqual([
      { what: "X Runechants", cards: 1 },
    ]);
    expect(missingFeatures(queue, ["partial", "undraftable"])).toEqual([
      { what: "X Runechants", cards: 2 },
    ]);
  });
});
