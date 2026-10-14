// README "Suggested core": card value = weighted average of dimension scores by priority.
import { describe, expect, it } from "vitest";
import { rankVariants, type RankingInput } from "./rank.ts";

const dimensions = [
  { id: 1, key: "rc", label: "Runechant creation" },
  { id: 2, key: "gc", label: "Gate creation" },
];
const variants = [
  { cardId: "a", variantId: "a1", name: "Alpha", pitch: 1 },
  { cardId: "b", variantId: "b1", name: "Bravo", pitch: 1 },
  { cardId: "c", variantId: "c1", name: "Charlie", pitch: 1 },
];
const community = (
  cardId: string,
  variantId: string,
  rc: number,
  gc: number,
  ratingCount = 3,
  usurper?: { rc: number; gc: number },
) =>
  (["forsaken", "usurper"] as const).flatMap((side) => {
    const s = side === "usurper" && usurper ? usurper : { rc, gc };
    return [
      { cardId, variantId, side, dimensionId: 1, score: s.rc, ratingCount },
      { cardId, variantId, side, dimensionId: 2, score: s.gc, ratingCount },
    ];
  });

const base = (over: Partial<RankingInput> = {}): RankingInput => ({
  variants,
  dimensions,
  community: [...community("a", "a1", 80, 20), ...community("b", "b1", 40, 90)],
  priorities: { rc: 100, gc: 100 },
  sourceBlend: 100,
  sideFocus: 50,
  minRatingCount: 2,
  ...over,
});
const order = (input: RankingInput) =>
  rankVariants(input).map((r) => r.variantId);

describe("rankVariants", () => {
  it("ranks by the weighted average of dimension scores", () => {
    const ranked = rankVariants(base());
    expect(ranked.map((r) => [r.variantId, r.value])).toEqual([
      ["b1", 65],
      ["a1", 50],
    ]);
  });

  it("follows the priorities", () => {
    expect(order(base({ priorities: { rc: 100, gc: 0 } }))).toEqual([
      "a1",
      "b1",
    ]);
    expect(order(base({ priorities: { rc: 0, gc: 100 } }))).toEqual([
      "b1",
      "a1",
    ]);
  });

  it("leaves out cards nobody has rated (c) and cards under the minimum rating count", () => {
    expect(order(base())).not.toContain("c1");
    const thin = base({
      community: [
        ...community("a", "a1", 80, 20, 1),
        ...community("b", "b1", 40, 90),
      ],
    });
    expect(order(thin)).toEqual(["b1"]);
  });

  it("blends my scores with the community's", () => {
    const mine = {
      rows: [
        {
          cardId: "a",
          variantId: null,
          side: null,
          dimensionId: 2,
          score: 100,
        },
      ],
      reviewedCardIds: new Set(["a"]),
    };
    // Mine only: a = (0 + 100)/2 = 50 (rc blank on a reviewed card counts 0); b has no review of mine -> community.
    expect(
      rankVariants(base({ mine, sourceBlend: 0 })).find(
        (r) => r.variantId === "a1",
      )?.value,
    ).toBe(50);
    // Half and half on a: rc (0 + 80)/2 = 40, gc (100 + 20)/2 = 60 -> 50
    expect(
      rankVariants(base({ mine, sourceBlend: 50 })).find(
        (r) => r.variantId === "a1",
      )?.value,
    ).toBe(50);
  });

  it("uses my scores for cards the community hasn't rated", () => {
    const mine = {
      rows: [
        { cardId: "c", variantId: null, side: null, dimensionId: 1, score: 60 },
      ],
      reviewedCardIds: new Set(["c"]),
    };
    expect(
      rankVariants(base({ mine, sourceBlend: 100 })).find(
        (r) => r.variantId === "c1",
      )?.value,
    ).toBe(30);
  });

  it("ignores my unreviewed drafts", () => {
    const mine = {
      rows: [
        { cardId: "c", variantId: null, side: null, dimensionId: 1, score: 60 },
      ],
      reviewedCardIds: new Set<string>(),
    };
    expect(order(base({ mine, sourceBlend: 0 }))).not.toContain("c1");
  });

  it("focuses on a side", () => {
    const sided = base({
      community: [
        ...community("a", "a1", 80, 80, 3, { rc: 0, gc: 0 }),
        ...community("b", "b1", 40, 40),
      ],
    });
    expect(order({ ...sided, sideFocus: 0 })).toEqual(["a1", "b1"]);
    expect(order({ ...sided, sideFocus: 100 })).toEqual(["b1", "a1"]);
  });

  it("returns no values when every priority is 0", () => {
    expect(
      rankVariants(base({ priorities: { rc: 0, gc: 0 } })).every(
        (r) => r.value === 0,
      ),
    ).toBe(true);
  });

  it("reports the rating count and each dimension's contribution", () => {
    const top = rankVariants(base())[0]!;
    expect(top.ratingCount).toBe(3);
    expect(top.parts).toEqual({ rc: 40, gc: 90 });
  });
});
