import { describe, expect, it } from "vitest";
import { buildScoringInput } from "../src/input.ts";

const db = {
  profiles: [
    { id: "u-user", role: "user" },
    { id: "u-scorer", role: "scorer" },
    { id: "u-curator", role: "curator" },
    { id: "u-admin", role: "admin" },
  ],
  raterWeights: [
    { user_id: "u-scorer", rating_weight: "1.0" },
    { user_id: "u-curator", rating_weight: "2.5" },
  ],
  cardReviews: [
    { user_id: "u-user", card_id: "c1" },
    { user_id: "u-scorer", card_id: "c1" },
  ],
  cardScores: [
    {
      user_id: "u-user",
      card_id: "c1",
      variant_id: null,
      side: null,
      dimension_id: 6,
      score: 100,
    },
    {
      user_id: "u-scorer",
      card_id: "c1",
      variant_id: "v1",
      side: "forsaken",
      dimension_id: 6,
      score: 70,
    },
  ],
  cards: [{ id: "c1", fringe: true }],
  variants: [
    { id: "v1", card_id: "c1" },
    { id: "v2", card_id: "c1" },
  ],
  scoreDimensions: [
    { id: 6, key: "overall" },
    { id: 4, key: "floor" },
    { id: 5, key: "ceiling" },
  ],
  appSettings: [
    { key: "fringe_default", value: 20 },
    { key: "fringe_k", value: 3 },
    { key: "min_rating_count", value: 2 },
  ],
};

describe("buildScoringInput", () => {
  const input = buildScoringInput(db);

  it("counts scorers, curators and admins, but not users", () => {
    expect(input.scorers.map((s) => s.userId).sort()).toEqual([
      "u-admin",
      "u-curator",
      "u-scorer",
    ]);
  });

  it("uses each scorer's hidden weight, defaulting to 1", () => {
    const weight = (id: string) =>
      input.scorers.find((s) => s.userId === id)?.weight;
    expect(weight("u-curator")).toBe(2.5);
    expect(weight("u-admin")).toBe(1);
  });

  it("attaches each scorer's reviews and scores", () => {
    const scorer = input.scorers.find((s) => s.userId === "u-scorer")!;
    expect(scorer.reviewedCardIds).toEqual(["c1"]);
    expect(scorer.scores).toEqual([
      {
        cardId: "c1",
        variantId: "v1",
        side: "forsaken",
        dimensionId: 6,
        score: 70,
      },
    ]);
  });

  it("groups variants under cards and keeps the fringe flag", () => {
    expect(input.cards).toEqual([
      { id: "c1", fringe: true, variantIds: ["v1", "v2"] },
    ]);
  });

  it("reads the fringe settings", () => {
    expect(input.settings).toEqual({ fringeDefault: 20, fringeK: 3 });
    expect(input.dimensionIds).toEqual([6, 4, 5]);
    // Floor and ceiling fall back to overall.
    expect(input.fallbacks).toEqual({ 4: 6, 5: 6 });
  });
});
