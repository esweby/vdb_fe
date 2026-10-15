import { describe, expect, it } from "vitest";
import { readRankingSearch, writeRankingSearch } from "./rankingSearch.ts";

describe("ranking URL state", () => {
  it("has sensible defaults", () => {
    expect(readRankingSearch({})).toEqual({
      risk: 0,
      sourceBlend: 100,
      sideFocus: 50,
      order: "score",
      core: {},
    });
    expect(writeRankingSearch(readRankingSearch({}))).toEqual({});
  });

  it("round-trips", () => {
    const state = {
      risk: -50,
      sourceBlend: 30,
      sideFocus: 0,
      order: "fits" as const,
      core: { a1: 3, b2: 1 },
    };
    expect(readRankingSearch(writeRankingSearch(state))).toEqual(state);
  });

  it("clamps and ignores junk", () => {
    expect(readRankingSearch({ risk: 500, blend: -5 })).toMatchObject({
      risk: 100,
      sourceBlend: 0,
    });
    expect(readRankingSearch({ risk: "x" })).toMatchObject({ risk: 0 });
    expect(readRankingSearch({ order: "random" })).toMatchObject({
      order: "score",
    });
  });

  it("keeps only whole, positive copies in the core", () => {
    expect(
      readRankingSearch({ core: { a: 2, b: 0, c: -1, d: "x", e: 9, f: 1.5 } })
        .core,
    ).toEqual({ a: 2, e: 9 });
    expect(readRankingSearch({ core: "nonsense" }).core).toEqual({});
  });
});
