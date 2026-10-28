import { describe, expect, it } from "vitest";
import type { EngineCard, ScenarioDefinition } from "@esweby/fab-engine";
import {
  differenceVerdict,
  goalVerdict,
  pairOutcomes,
  pairedDifference,
  runGoals,
} from "./planGoals.ts";

/** n runs: the first `both` succeed on both sides, then only A, then only B, the rest neither. */
const outcomes = (n: number, both: number, onlyA: number, onlyB: number) => {
  const a: boolean[] = [];
  const b: boolean[] = [];
  for (let i = 0; i < n; i++) {
    a.push(i < both + onlyA);
    b.push(i < both || (i >= both + onlyA && i < both + onlyA + onlyB));
  }
  return { a, b };
};

describe("pairOutcomes", () => {
  it("counts the runs where only one side succeeded", () => {
    const { a, b } = outcomes(100, 30, 15, 5);
    expect(pairOutcomes(a, b)).toEqual({
      runs: 100,
      a: 45,
      b: 35,
      onlyA: 15,
      onlyB: 5,
    });
  });

  it("refuses runs that don't line up", () => {
    expect(() => pairOutcomes([true], [true, false])).toThrow();
  });
});

describe("pairedDifference", () => {
  it("is the difference in rates with a 95% interval for paired runs", () => {
    const { a, b } = outcomes(100, 30, 15, 5);
    const d = pairedDifference(pairOutcomes(a, b));
    expect(d.difference).toBeCloseTo(0.1, 10);
    // se = √(15 + 5 − (15 − 5)²/100) / 100 = √19 / 100
    expect(d.low).toBeCloseTo(0.1 - (1.96 * Math.sqrt(19)) / 100, 10);
    expect(d.high).toBeCloseTo(0.1 + (1.96 * Math.sqrt(19)) / 100, 10);
  });

  it("is exactly zero when both sides did the same in every run", () => {
    const { a, b } = outcomes(100, 40, 0, 0);
    expect(pairedDifference(pairOutcomes(a, b))).toEqual({
      difference: 0,
      low: 0,
      high: 0,
    });
  });
});

describe("differenceVerdict", () => {
  it("names a side only when the interval leaves out 0", () => {
    const clear = outcomes(100, 30, 15, 5);
    expect(
      differenceVerdict(pairedDifference(pairOutcomes(clear.a, clear.b))),
    ).toBe("higher");
    expect(
      differenceVerdict(pairedDifference(pairOutcomes(clear.b, clear.a))),
    ).toBe("lower");
  });

  it("says no clear difference when the interval includes 0", () => {
    const close = outcomes(100, 30, 6, 4);
    expect(
      differenceVerdict(pairedDifference(pairOutcomes(close.a, close.b))),
    ).toBe("no clear difference");
    expect(differenceVerdict({ difference: 0, low: 0, high: 0 })).toBe(
      "no clear difference",
    );
  });
});

describe("goalVerdict", () => {
  it("is met when the whole interval is above the target", () => {
    const g = goalVerdict(450, 1000, 0.4);
    expect(g.verdict).toBe("met");
    expect(g.rate).toBe(0.45);
    expect(g.low).toBeGreaterThan(0.4);
  });

  it("is not met when the whole interval is below the target", () => {
    expect(goalVerdict(300, 1000, 0.4).verdict).toBe("not met");
  });

  it("gives no clear answer when the interval includes the target", () => {
    expect(goalVerdict(380, 1000, 0.4).verdict).toBe("no clear answer");
    expect(goalVerdict(400, 1000, 0.4).verdict).toBe("no clear answer");
  });
});

const card = (name: string): EngineCard => ({
  id: name,
  name,
  pitch: 1,
  roles: [],
  traits: [],
  amounts: {},
});
const wantsA: ScenarioDefinition = {
  version: 1,
  name: "An A in the opening hand",
  horizon: 0,
  turnModel: "fresh",
  access: ["hand"],
  condition: { all: [{ label: "an A", filter: { name: "A" }, min: 1 }] },
};
const deckOf = (copiesOfA: number) => ({
  core: [
    { card: card("A"), copies: copiesOfA },
    { card: card("B"), copies: 40 - copiesOfA },
  ],
  gear: [],
  deckSize: 40,
});

describe("runGoals", () => {
  it("runs both sides on the same seeds, so the same deck never differs from itself", () => {
    const [result] = runGoals({
      kind: "plan-goals",
      goals: [{ key: "g", definition: wantsA }],
      plan: deckOf(3),
      other: deckOf(3),
      runs: 2000,
      seed: 5,
    });
    expect(result!.paired!.onlyA).toBe(0);
    expect(result!.paired!.onlyB).toBe(0);
    expect(result!.paired!.runs).toBe(2000);
  });

  it("pairs a changed plan run by run against the other side", () => {
    const [result] = runGoals({
      kind: "plan-goals",
      goals: [{ key: "g", definition: wantsA }],
      plan: deckOf(6),
      other: deckOf(3),
      runs: 2000,
      seed: 5,
    });
    expect(result!.key).toBe("g");
    expect(result!.paired!.a).toBeGreaterThan(result!.paired!.b);
    expect(differenceVerdict(pairedDifference(result!.paired!))).toBe("higher");
  });

  it("says why a goal couldn't run instead of failing them all", () => {
    const results = runGoals({
      kind: "plan-goals",
      goals: [
        {
          key: "too many",
          definition: {
            ...wantsA,
            fixed: Array.from({ length: 4 }, () => ({
              name: "A",
              zone: "hand" as const,
            })),
          },
        },
        { key: "fine", definition: wantsA },
      ],
      plan: deckOf(3),
      other: deckOf(3),
      runs: 200,
      seed: 5,
    });
    expect(results[0]!.error).toBeTruthy();
    expect(results[0]!.paired).toBeUndefined();
    expect(results[1]!.paired!.runs).toBe(200);
  });
});
