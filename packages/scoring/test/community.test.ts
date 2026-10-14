// README "Rater weighting", "Fringe cards" and the rating count rules.
import { describe, expect, it } from "vitest";
import { communityScore } from "../src/community.ts";

const settings = { fringeDefault: 20, fringeK: 3 };

describe("communityScore", () => {
  it("is the weighted average of resolved scores", () => {
    expect(
      communityScore(
        [
          { score: 100, weight: 1 },
          { score: 40, weight: 2 },
        ],
        { fringe: false, settings },
      ),
    ).toEqual({ score: 60, ratingCount: 2, totalWeight: 3 });
  });

  it("counts a 0 with the scorer's full weight", () => {
    expect(
      communityScore(
        [
          { score: 0, weight: 2 },
          { score: 90, weight: 1 },
        ],
        { fringe: false, settings },
      )?.score,
    ).toBe(30);
  });

  it("doesn't damp a non-fringe card: one 100 is 100", () => {
    expect(
      communityScore([{ score: 100, weight: 1 }], { fringe: false, settings }),
    ).toEqual({ score: 100, ratingCount: 1, totalWeight: 1 });
  });

  it("holds a fringe card down with its default: one 100 is 40", () => {
    expect(
      communityScore([{ score: 100, weight: 1 }], { fringe: true, settings }),
    ).toEqual({ score: 40, ratingCount: 1, totalWeight: 4 });
  });

  it("never counts the fringe default as a rating", () => {
    expect(
      communityScore(
        [
          { score: 80, weight: 1 },
          { score: 80, weight: 1 },
        ],
        { fringe: true, settings },
      )?.ratingCount,
    ).toBe(2);
  });

  it("has no score when nobody has rated the card, fringe or not", () => {
    expect(communityScore([], { fringe: false, settings })).toBeNull();
    expect(communityScore([], { fringe: true, settings })).toBeNull();
  });

  it("rounds to 2 decimal places", () => {
    expect(
      communityScore(
        [
          { score: 10, weight: 1 },
          { score: 20, weight: 1 },
          { score: 20, weight: 1 },
        ],
        { fringe: false, settings },
      )?.score,
    ).toBe(16.67);
  });
});
