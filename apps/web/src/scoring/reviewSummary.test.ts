import { describe, expect, it } from "vitest";
import { reviewSummary, suggestedFixes } from "./reviewSummary.ts";

const dims = [{ id: 1, key: "rc", label: "Runechant creation" }];
const variants = [
  { id: "red", pitch: 1 },
  { id: "yellow", pitch: 2 },
];
const row = (
  score: number,
  variantId: string | null = null,
  side: "forsaken" | "usurper" | null = null,
) => ({
  variantId,
  side,
  dimensionId: 1,
  score,
});
const cell = (
  s: ReturnType<typeof reviewSummary>,
  variantId: string,
  side: "forsaken" | "usurper",
) => s.find((c) => c.variantId === variantId && c.side === side)!;

describe("reviewSummary", () => {
  it("covers every dimension, variant and side", () => {
    expect(reviewSummary([], dims, variants)).toHaveLength(4);
  });

  it("labels a value set on that exact cell", () => {
    const s = reviewSummary([row(60, "red", "forsaken")], dims, variants);
    expect(cell(s, "red", "forsaken")).toMatchObject({
      value: 60,
      source: "set",
    });
  });

  it("labels inherited values", () => {
    const s = reviewSummary([row(70)], dims, variants);
    expect(cell(s, "yellow", "usurper")).toMatchObject({
      value: 70,
      source: "inherited",
    });
  });

  it("labels an explicit 0 as not relevant", () => {
    const s = reviewSummary([row(0, "red", "usurper")], dims, variants);
    expect(cell(s, "red", "usurper")).toMatchObject({
      value: 0,
      source: "not_relevant",
    });
  });

  it("labels blanks, which count as 0", () => {
    const s = reviewSummary([row(80, "red")], dims, variants);
    expect(cell(s, "yellow", "forsaken")).toMatchObject({
      value: 0,
      source: "blank",
    });
    expect(cell(s, "red", "forsaken")).toMatchObject({
      value: 80,
      source: "inherited",
    });
  });
});

describe("suggestedFixes", () => {
  it("offers to use a pitch's score for the whole card when other pitches are blank (the trap)", () => {
    expect(suggestedFixes([row(80, "red")], dims, variants)).toEqual([
      {
        dimensionId: 1,
        label: "Runechant creation",
        score: 80,
        description:
          "Use 80 for the whole card, so blank pitches and sides inherit it",
      },
    ]);
  });

  it("offers nothing when a dimension is fully blank (deliberately not relevant)", () => {
    expect(suggestedFixes([], dims, variants)).toEqual([]);
  });

  it("offers nothing when nothing is blank", () => {
    expect(suggestedFixes([row(70)], dims, variants)).toEqual([]);
  });

  it("suggests the highest set score when several differ", () => {
    expect(
      suggestedFixes(
        [row(40, "red", "forsaken"), row(60, "red", "usurper")],
        dims,
        variants,
      )[0]?.score,
    ).toBe(60);
  });
});
