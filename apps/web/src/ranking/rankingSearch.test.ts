import { describe, expect, it } from "vitest";
import { readRankingSearch, writeRankingSearch } from "./rankingSearch.ts";

describe("ranking URL state", () => {
  it("has sensible defaults", () => {
    expect(readRankingSearch({})).toEqual({
      risk: 0,
      sourceBlend: 100,
      sideFocus: 50,
      coreSize: 20,
      pinned: [],
      excluded: [],
    });
    expect(writeRankingSearch(readRankingSearch({}))).toEqual({});
  });

  it("round-trips", () => {
    const state = {
      risk: -50,
      sourceBlend: 30,
      sideFocus: 0,
      coreSize: 15,
      pinned: ["a1"],
      excluded: ["b1"],
    };
    expect(readRankingSearch(writeRankingSearch(state))).toEqual(state);
  });

  it("clamps and ignores junk", () => {
    expect(readRankingSearch({ risk: 500, blend: -5, core: 0 })).toMatchObject({
      risk: 100,
      sourceBlend: 0,
      coreSize: 1,
    });
    expect(readRankingSearch({ risk: "x" })).toMatchObject({ risk: 0 });
  });
});
