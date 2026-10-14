// The whole community score job's logic, without the database.
import { describe, expect, it } from "vitest";
import { computeCommunityScores } from "../src/compute.ts";

const settings = { fringeDefault: 20, fringeK: 3 };
const UTILITY = 6;

const input = (overrides = {}) => ({
  cards: [
    { id: "card-a", fringe: false, variantIds: ["a-red", "a-blue"] },
    { id: "card-b", fringe: true, variantIds: ["b-blue"] },
  ],
  dimensionIds: [UTILITY],
  settings,
  scorers: [
    {
      userId: "alice",
      weight: 1,
      reviewedCardIds: ["card-a", "card-b"],
      scores: [
        {
          cardId: "card-a",
          variantId: null,
          side: null,
          dimensionId: UTILITY,
          score: 80,
        },
        {
          cardId: "card-b",
          variantId: null,
          side: null,
          dimensionId: UTILITY,
          score: 100,
        },
      ],
    },
    {
      userId: "bob",
      weight: 1,
      reviewedCardIds: ["card-a"],
      scores: [
        {
          cardId: "card-a",
          variantId: "a-blue",
          side: "usurper" as const,
          dimensionId: UTILITY,
          score: 40,
        },
        // A draft on a card Bob hasn't reviewed: doesn't count.
        {
          cardId: "card-b",
          variantId: null,
          side: null,
          dimensionId: UTILITY,
          score: 0,
        },
      ],
    },
  ],
  ...overrides,
});

const find = (
  rows: ReturnType<typeof computeCommunityScores>,
  variantId: string,
  side: string,
) =>
  rows.find(
    (r) =>
      r.variantId === variantId && r.side === side && r.dimensionId === UTILITY,
  );

describe("computeCommunityScores", () => {
  const rows = computeCommunityScores(input());

  it("writes one row per variant, side and dimension that someone has reviewed", () => {
    expect(rows).toHaveLength(6);
  });

  it("resolves each scorer first, then averages", () => {
    // Alice 80 everywhere on card A. Bob: blue + Usurper 40, blank elsewhere so 0.
    expect(find(rows, "a-blue", "usurper")).toMatchObject({
      score: 60,
      ratingCount: 2,
    });
    expect(find(rows, "a-red", "forsaken")).toMatchObject({
      score: 40,
      ratingCount: 2,
    });
  });

  it("ignores drafts on cards the scorer hasn't marked reviewed", () => {
    // Only Alice reviewed card B: fringe, one 100 -> 40.
    expect(find(rows, "b-blue", "forsaken")).toMatchObject({
      cardId: "card-b",
      score: 40,
      ratingCount: 1,
      totalWeight: 4,
    });
  });

  it("writes nothing for cards nobody has reviewed", () => {
    const none = computeCommunityScores(
      input({
        scorers: [
          { userId: "carol", weight: 1, reviewedCardIds: [], scores: [] },
        ],
      }),
    );
    expect(none).toEqual([]);
  });

  it("applies rater weight", () => {
    const weighted = computeCommunityScores(
      input({
        scorers: input().scorers.map((s) =>
          s.userId === "alice" ? { ...s, weight: 3 } : s,
        ),
      }),
    );
    // (3 * 80 + 1 * 40) / 4 = 70
    expect(find(weighted, "a-blue", "usurper")).toMatchObject({
      score: 70,
      totalWeight: 4,
    });
  });
});
