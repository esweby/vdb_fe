// README "Ranking": one risk setting r in [-1, 1] tilts between floor, overall and ceiling:
// S = O + max(r,0)(C − O) + min(r,0)(O − F). r = 0 is overall, 1 ceiling, −1 floor.
import { describe, expect, it } from "vitest";
import { rankVariants, type RankingInput } from "./rank.ts";

const FLOOR = 1;
const CEILING = 2;
const OVERALL = 3;
const dimensions = [
  { id: FLOOR, key: "floor", label: "Floor" },
  { id: CEILING, key: "ceiling", label: "Ceiling" },
  { id: OVERALL, key: "overall", label: "Overall" },
];
const variants = [
  { cardId: "a", variantId: "a1", name: "Alpha", pitch: 1 },
  { cardId: "b", variantId: "b1", name: "Bravo", pitch: 1 },
  { cardId: "c", variantId: "c1", name: "Charlie", pitch: 1 },
];
type Ratings = { f: number; c: number; o: number };
const community = (
  cardId: string,
  variantId: string,
  forsaken: Ratings,
  options: { ratingCount?: number; usurper?: Ratings } = {},
) =>
  (["forsaken", "usurper"] as const).flatMap((side) => {
    const r =
      side === "usurper" && options.usurper ? options.usurper : forsaken;
    return [
      [FLOOR, r.f],
      [CEILING, r.c],
      [OVERALL, r.o],
    ].map(([dimensionId, score]) => ({
      cardId,
      variantId,
      side,
      dimensionId: dimensionId!,
      score: score!,
      ratingCount: options.ratingCount ?? 3,
    }));
  });

// Alpha is steady (60 everywhere). Bravo is swingy: floor 20, overall 50, ceiling 100.
const base = (over: Partial<RankingInput> = {}): RankingInput => ({
  variants,
  dimensions,
  community: [
    ...community("a", "a1", { f: 60, c: 60, o: 60 }),
    ...community("b", "b1", { f: 20, c: 100, o: 50 }),
  ],
  risk: 0,
  sourceBlend: 100,
  sideFocus: 50,
  minRatingCount: 2,
  ...over,
});
const values = (input: RankingInput) =>
  rankVariants(input).map((r) => [r.variantId, r.value]);

describe("rankVariants", () => {
  it("ranks by overall when risk is balanced (0)", () => {
    expect(values(base())).toEqual([
      ["a1", 60],
      ["b1", 50],
    ]);
  });

  it("ranks by ceiling at full high-roll (1) and by floor at full consistent (−1)", () => {
    expect(values(base({ risk: 100 }))).toEqual([
      ["b1", 100],
      ["a1", 60],
    ]);
    expect(values(base({ risk: -100 }))).toEqual([
      ["a1", 60],
      ["b1", 20],
    ]);
  });

  it("tilts part of the way: halfway to the ceiling, or halfway to the floor", () => {
    // Bravo: 50 + 0.5 × (100 − 50) = 75; 50 − 0.5 × (50 − 20) = 35
    expect(values(base({ risk: 50 }))).toEqual([
      ["b1", 75],
      ["a1", 60],
    ]);
    expect(values(base({ risk: -50 }))).toEqual([
      ["a1", 60],
      ["b1", 35],
    ]);
  });

  it("leaves out cards nobody has rated (c) and cards under the minimum rating count", () => {
    expect(rankVariants(base()).map((r) => r.variantId)).not.toContain("c1");
    const few = base({
      community: community(
        "a",
        "a1",
        { f: 60, c: 60, o: 60 },
        { ratingCount: 1 },
      ),
    });
    expect(rankVariants(few)).toEqual([]);
  });

  it("blends my ratings with the community's, rating by rating", () => {
    const input = base({
      sourceBlend: 50,
      mine: {
        rows: [
          {
            cardId: "a",
            variantId: null,
            side: null,
            dimensionId: OVERALL,
            score: 100,
          },
        ],
        reviewedCardIds: new Set(["a"]),
      },
    });
    // Alpha overall: (100 + 60) / 2 = 80
    expect(rankVariants(input).find((r) => r.variantId === "a1")?.value).toBe(
      80,
    );
  });

  it("treats my blank floor and ceiling as my overall", () => {
    const input = base({
      community: [],
      risk: 100,
      mine: {
        rows: [
          {
            cardId: "c",
            variantId: null,
            side: null,
            dimensionId: OVERALL,
            score: 70,
          },
        ],
        reviewedCardIds: new Set(["c"]),
      },
    });
    expect(values(input)).toEqual([["c1", 70]]);
  });

  it("ignores my unreviewed drafts", () => {
    const input = base({
      community: [],
      mine: {
        rows: [
          {
            cardId: "c",
            variantId: null,
            side: null,
            dimensionId: OVERALL,
            score: 70,
          },
        ],
        reviewedCardIds: new Set(),
      },
    });
    expect(rankVariants(input)).toEqual([]);
  });

  it("focuses on a side", () => {
    const input = base({
      community: community(
        "a",
        "a1",
        { f: 0, c: 0, o: 0 },
        { usurper: { f: 100, c: 100, o: 100 } },
      ),
    });
    expect(values({ ...input, sideFocus: 0 })).toEqual([["a1", 0]]);
    expect(values({ ...input, sideFocus: 100 })).toEqual([["a1", 100]]);
    expect(values({ ...input, sideFocus: 50 })).toEqual([["a1", 50]]);
  });

  it("reports the rating count and the floor, ceiling and overall used", () => {
    const b = rankVariants(base()).find((r) => r.variantId === "b1")!;
    expect(b.ratingCount).toBe(3);
    expect(b.parts).toEqual({ floor: 20, ceiling: 100, overall: 50 });
  });
});
