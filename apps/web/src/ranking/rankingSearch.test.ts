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
      prefs: {},
      synergy: 0,
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
      prefs: { usurp: 100, runeGate: 0 },
      synergy: 60,
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

  it("keeps preferences between 0 and 100 and drops neutral ones", () => {
    expect(
      readRankingSearch({ pref: { usurp: 150, runeGate: 50, x: "y" } }).prefs,
    ).toEqual({ usurp: 100 });
  });

  it("keeps only whole, positive copies in the core", () => {
    expect(
      readRankingSearch({ core: { a: 2, b: 0, c: -1, d: "x", e: 9, f: 1.5 } })
        .core,
    ).toEqual({ a: 2, e: 9 });
    expect(readRankingSearch({ core: "nonsense" }).core).toEqual({});
  });

  // Synergy strength starts off, so the ranking doesn't change until the scoring group
  // agrees a default (docs/synergy-rules.md).
  it("keeps synergy strength between 0 and 100, off by default", () => {
    expect(readRankingSearch({ syn: 250 }).synergy).toBe(100);
    expect(readRankingSearch({ syn: "x" }).synergy).toBe(0);
    expect(writeRankingSearch(readRankingSearch({ syn: 40 }))).toEqual({
      syn: 40,
    });
  });
});
