import { describe, expect, it } from "vitest";
import { readRankingSearch, writeRankingSearch } from "./rankingSearch.ts";

describe("ranking URL state", () => {
  it("has sensible defaults", () => {
    expect(readRankingSearch({}, ["rc", "gc"])).toEqual({
      priorities: { rc: 50, gc: 50 },
      sourceBlend: 100,
      sideFocus: 50,
      coreSize: 20,
      pinned: [],
      excluded: [],
    });
  });

  it("round-trips", () => {
    const state = {
      priorities: { rc: 100, gc: 0 },
      sourceBlend: 30,
      sideFocus: 0,
      coreSize: 15,
      pinned: ["a1"],
      excluded: ["b1"],
    };
    expect(readRankingSearch(writeRankingSearch(state), ["rc", "gc"])).toEqual(
      state,
    );
  });

  it("clamps and ignores junk", () => {
    expect(
      readRankingSearch(
        { w: ["rc:500", "zz:10", "gc:x"], blend: -5, core: 0 },
        ["rc", "gc"],
      ),
    ).toMatchObject({
      priorities: { rc: 100, gc: 50 },
      sourceBlend: 0,
      coreSize: 1,
    });
  });
});
