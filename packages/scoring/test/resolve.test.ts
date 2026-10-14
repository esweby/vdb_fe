// README "Reviews and blank scores": each scorer's score is resolved first, then averaged.
import { describe, expect, it } from "vitest";
import { resolveScore, type ScoreRow } from "../src/resolve.ts";

const RED = "variant-red";
const YELLOW = "variant-yellow";
const GATE = 2;
const at = (variantId: string, side: "forsaken" | "usurper" = "forsaken") => ({
  variantId,
  side,
  dimensionId: GATE,
});
const row = (
  score: number,
  variantId: string | null = null,
  side: "forsaken" | "usurper" | null = null,
): ScoreRow => ({ variantId, side, dimensionId: GATE, score });

describe("resolveScore", () => {
  it("a blank uses the level above: a card-level score covers every variant and side", () => {
    expect(resolveScore([row(70)], at(RED), true)).toBe(70);
    expect(resolveScore([row(70)], at(YELLOW, "usurper"), true)).toBe(70);
  });

  it("the most specific score wins: variant + side, then variant, then card + side, then card", () => {
    const rows = [
      row(10),
      row(20, null, "forsaken"),
      row(30, RED),
      row(40, RED, "forsaken"),
    ];
    expect(resolveScore(rows, at(RED, "forsaken"), true)).toBe(40);
    expect(resolveScore(rows, at(RED, "usurper"), true)).toBe(30);
    expect(resolveScore(rows, at(YELLOW, "forsaken"), true)).toBe(20);
    expect(resolveScore(rows, at(YELLOW, "usurper"), true)).toBe(10);
  });

  it("an explicit 'not relevant' (0) on a side beats the card-level score", () => {
    expect(
      resolveScore(
        [row(70), row(0, null, "usurper")],
        at(RED, "usurper"),
        true,
      ),
    ).toBe(0);
  });

  it("a top-level blank on a reviewed card is 0", () => {
    expect(resolveScore([], at(RED), true)).toBe(0);
  });

  it("a blank on an unreviewed card is unknown, not 0", () => {
    expect(resolveScore([], at(RED), false)).toBeNull();
    expect(resolveScore([row(70)], at(RED), false)).toBe(70);
  });

  it("the red-80-yellow-blank trap: yellow resolves to 0 once reviewed (the review summary warns about this)", () => {
    expect(resolveScore([row(80, RED)], at(YELLOW), true)).toBe(0);
  });

  it("ignores rows for other dimensions", () => {
    expect(resolveScore([{ ...row(90), dimensionId: 99 }], at(RED), true)).toBe(
      0,
    );
  });
});

// README "Floor, ceiling and overall": a blank floor or ceiling, at every level, means
// "the same as overall". Cards without conditions are only asked overall, so they collapse.
describe("resolveScore with a fallback (floor and ceiling fall back to overall)", () => {
  const FLOOR = 1;
  const OVERALL = 3;
  const r = (
    dimensionId: number,
    score: number,
    variantId: string | null = null,
  ): ScoreRow => ({ variantId, side: null, dimensionId, score });
  const floorAt = {
    variantId: RED,
    side: "forsaken" as const,
    dimensionId: FLOOR,
  };

  it("uses overall when floor is blank at every level", () => {
    expect(
      resolveScore([r(OVERALL, 70)], floorAt, true, {
        fallbackDimensionId: OVERALL,
      }),
    ).toBe(70);
  });

  it("uses the floor when one is set at any level, even if overall is more specific", () => {
    expect(
      resolveScore([r(FLOOR, 40), r(OVERALL, 70, RED)], floorAt, true, {
        fallbackDimensionId: OVERALL,
      }),
    ).toBe(40);
  });

  it("is 0 on a reviewed card with nothing set, and unknown on an unreviewed one", () => {
    expect(
      resolveScore([], floorAt, true, { fallbackDimensionId: OVERALL }),
    ).toBe(0);
    expect(
      resolveScore([], floorAt, false, { fallbackDimensionId: OVERALL }),
    ).toBeNull();
  });
});
