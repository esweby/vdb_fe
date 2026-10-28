import { describe, expect, it } from "vitest";
import {
  analysisCases,
  runFullAnalysis,
  summariseChainRuns,
} from "./fullAnalysis.ts";

describe("full analysis measures", () => {
  it("reports setup speed and reliability at the agreed turn marks", () => {
    const summary = summariseChainRuns([
      { completed: true, setupTurn: 2, payoffTurn: 2 },
      { completed: true, setupTurn: 3, payoffTurn: 4 },
      { completed: true, setupTurn: 5, payoffTurn: 6 },
      { completed: true, setupTurn: 7, payoffTurn: 8 },
      { completed: true, setupTurn: 2, payoffTurn: null },
      { completed: true, setupTurn: null, payoffTurn: null },
      { completed: false, setupTurn: null, payoffTurn: null },
    ]);

    expect(summary).toEqual({
      completedRuns: 6,
      failedRuns: 1,
      byTurn: { 4: 2 / 6, 6: 3 / 6, 8: 4 / 6 },
      medianTurn: 5,
      incompleteByTurn8: 2 / 6,
      sameTurn: 1 / 4,
      chains: 4,
    });
  });

  it("has no median or same-turn rate when no chain completes", () => {
    expect(
      summariseChainRuns([{ completed: true, setupTurn: 2, payoffTurn: null }]),
    ).toMatchObject({ medianTurn: null, sameTurn: null, chains: 0 });
  });

  it("shares the run budget across all fixed Cull and Scar answers", () => {
    const cases = analysisCases(1_000, 20_261_027);
    expect(cases).toHaveLength(4);
    expect(cases.reduce((total, item) => total + item.runs, 0)).toBe(1_000);
    expect(new Set(cases.map((item) => item.seed)).size).toBe(4);
    expect(cases.map((item) => item.choices.conditions)).toEqual([
      {
        hero_lost_life_this_turn: false,
        less_life_than_opposing_hero: false,
      },
      {
        hero_lost_life_this_turn: false,
        less_life_than_opposing_hero: true,
      },
      {
        hero_lost_life_this_turn: true,
        less_life_than_opposing_hero: false,
      },
      {
        hero_lost_life_this_turn: true,
        less_life_than_opposing_hero: true,
      },
    ]);
  });

  it("runs every case through the reviewed policy and combines the results", () => {
    const result = runFullAnalysis({
      kind: "full-analysis",
      runs: 4,
      seed: 17,
      turns: 2,
      decks: [
        {
          id: "empty",
          label: "Empty test deck",
          source: "player",
          deck: [],
          weapons: [],
          equipment: [],
          coverage: { modelled: 0, total: 0, unmodelled: [] },
        },
      ],
    });

    expect(result.rows[0]!.summary).toMatchObject({
      completedRuns: 4,
      failedRuns: 0,
      chains: 0,
    });
  });
});
