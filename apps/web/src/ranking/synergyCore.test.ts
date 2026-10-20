// Synergy in the ranking (README "Suggested core", docs/synergy-rules.md "Synergy in the
// ranking"): cards are picked one at a time by value + synergy with cards already picked.
import type { SynergyEdge } from "@vdb/cards";
import { describe, expect, it } from "vitest";
import { suggestCore, type CoreConstraints } from "./suggestCore.ts";
import {
  buildSynergyGraph,
  fillWithSynergy,
  synergyBonus,
  weightedEdges,
} from "./synergyCore.ts";

const derived = (
  from: string,
  to: string,
  weight: number,
  reasons: string[],
  engine: SynergyEdge["engine"] = "gate",
): SynergyEdge => ({ from, to, weight, engine, reasons, traverse: false });

describe("buildSynergyGraph", () => {
  it("links both cards of a derived edge, at the rule's weight", () => {
    const graph = buildSynergyGraph({
      derived: [derived("gen", "target", 0.8, ["gate-feeds-gate-target"])],
      ruleWeights: {},
      feedback: [],
      community: [],
    });
    expect(graph.get("gen")).toEqual([
      { other: "target", weight: 0.8, bucket: "gate" },
    ]);
    expect(graph.get("target")).toEqual([
      { other: "gen", weight: 0.8, bucket: "gate" },
    ]);
  });

  it("uses the scoring group's feedback on a rule, at the rule's current weight", () => {
    const graph = buildSynergyGraph({
      derived: [derived("gen", "target", 0.5, ["gate-feeds-gate-target"])],
      ruleWeights: { "gate-feeds-gate-target": 0.5 },
      feedback: [
        {
          ruleId: "gate-feeds-gate-target",
          fromCardId: "gen",
          toCardId: "target",
          confirmShare: 0.5,
          fixedPart: 0.1,
        },
      ],
      community: [],
    });
    // 0.5 × 0.5 + 0.1
    expect(graph.get("gen")?.[0]?.weight).toBe(0.35);
  });

  it("adds the scoring group's own edges, taking the higher weight where a rule agrees", () => {
    const graph = buildSynergyGraph({
      derived: [derived("gen", "target", 0.6, ["gate-feeds-gate-target"])],
      ruleWeights: {},
      feedback: [],
      community: [
        { fromCardId: "gen", toCardId: "target", weight: 0.9 },
        { fromCardId: "a", toCardId: "b", weight: 0.4 },
      ],
    });
    expect(graph.get("gen")).toEqual([
      { other: "target", weight: 0.9, bucket: "gate" },
    ]);
    expect(graph.get("a")).toEqual([
      { other: "b", weight: 0.4, bucket: "community" },
    ]);
  });

  it("puts direct references in a bucket of their own", () => {
    const graph = buildSynergyGraph({
      derived: [derived("tutor", "sinchant", 0.6, ["tutor-finds"], null)],
      ruleWeights: {},
      feedback: [],
      community: [],
    });
    expect(graph.get("tutor")?.[0]?.bucket).toBe("reference");
  });
});

describe("synergyBonus", () => {
  const graph = buildSynergyGraph({
    derived: [
      derived("gen1", "target", 0.8, ["gate-feeds-gate-target"]),
      derived("gen2", "target", 0.8, ["gate-feeds-gate-target"]),
      derived("aura", "target", 0.5, ["aura-feeds-aura-payoff"], "aura"),
    ],
    ruleWeights: {},
    feedback: [],
    community: [],
  });

  it("is 0 with nothing picked, or at strength 0", () => {
    expect(synergyBonus("target", new Set(), graph, 10)).toBe(0);
    expect(synergyBonus("target", new Set(["gen1"]), graph, 0)).toBe(0);
  });

  it("is the strength times the weight of links to picked cards", () => {
    expect(synergyBonus("target", new Set(["gen1"]), graph, 10)).toBe(8);
  });

  it("saturates at 1 per engine, so ten partners count about as much as two", () => {
    // Gate: 0.8 + 0.8 → 1; aura: 0.5.
    expect(
      synergyBonus("target", new Set(["gen1", "gen2", "aura"]), graph, 10),
    ).toBe(15);
  });

  it("counts both directions: a generator gains from payoffs already picked", () => {
    expect(synergyBonus("gen1", new Set(["target"]), graph, 10)).toBe(8);
  });
});

describe("fillWithSynergy", () => {
  const constraints = (
    locked: [string, number][] = [],
    targets = { 1: 3 },
  ): CoreConstraints => ({
    targets,
    copiesEach: 3,
    copyLimit: 3,
    locked: new Map(locked),
    removed: new Set(),
  });
  const candidates = [
    { variantId: "v-high", cardId: "high", pitch: 1, value: 70 },
    { variantId: "v-partner", cardId: "partner", pitch: 1, value: 60 },
    { variantId: "v-gen", cardId: "gen", pitch: 1, value: 50 },
  ];
  const graph = buildSynergyGraph({
    derived: [derived("gen", "partner", 0.8, ["gate-feeds-gate-target"])],
    ruleWeights: {},
    feedback: [],
    community: [],
  });

  it("with no synergy, picks the same cards as filling by value", () => {
    const plain = suggestCore(candidates, constraints());
    const greedy = fillWithSynergy(candidates, constraints(), () => 0);
    expect(greedy.picks.map((p) => [p.variantId, p.quantity]).sort()).toEqual(
      plain.picks.map((p) => [p.variantId, p.quantity]).sort(),
    );
  });

  it("builds around locked cards: a partner of a card in the core beats a better card that isn't", () => {
    const s = fillWithSynergy(
      candidates,
      constraints([["v-gen", 3]], { 1: 6 }),
      (cardId, picked) => synergyBonus(cardId, picked, graph, 20),
    );
    // partner: 60 + 0.8 × 20 = 76 beats high: 70.
    expect(s.picks.map((p) => p.variantId)).toEqual(["v-partner", "v-gen"]);
  });

  it("still fills to the pitch targets and no further", () => {
    const s = fillWithSynergy(
      candidates,
      constraints([], { 1: 4 }),
      (cardId, picked) => synergyBonus(cardId, picked, graph, 20),
    );
    expect(s.byPitch).toEqual([{ pitch: 1, target: 4, filled: 4 }]);
  });
});

describe("fillWithSynergy and defence reactions", () => {
  it("skips a pitch that isn't suggested", () => {
    const s = fillWithSynergy(
      [
        {
          variantId: "ff3",
          cardId: "ff",
          pitch: 3,
          value: 99,
          notSuggested: true,
        },
        { variantId: "b1", cardId: "b", pitch: 3, value: 50 },
      ],
      {
        targets: { 3: 3 },
        copiesEach: 3,
        copyLimit: 3,
        locked: new Map(),
        removed: new Set(),
      },
      () => 0,
    );
    expect(s.picks.map((p) => p.variantId)).toEqual(["b1"]);
  });
});

describe("weightedEdges", () => {
  it("says which links come from the rules, the scoring group, or both", () => {
    const list = weightedEdges({
      derived: [derived("a", "b", 0.8, ["gate-feeds-gate-target"])],
      ruleWeights: {},
      feedback: [],
      community: [
        { fromCardId: "a", toCardId: "b", weight: 0.9 },
        { fromCardId: "c", toCardId: "d", weight: 0.4 },
      ],
    });
    expect(list.map((e) => [e.from, e.to, e.weight, e.kind])).toEqual([
      ["a", "b", 0.9, "both"],
      ["c", "d", 0.4, "community"],
    ]);
  });
});

// Feature 3 (maintainer, 19 Oct 2026): how sure we are of each link.
describe("weightedEdges: status", () => {
  const rule = derived("gen", "target", 0.8, ["gate-feeds-gate-target"]);
  const fb = (confirmShare: number, fixedPart: number, ratingCount = 3) => ({
    ruleId: "gate-feeds-gate-target",
    fromCardId: "gen",
    toCardId: "target",
    confirmShare,
    fixedPart,
    ratingCount,
  });
  const status = (input: Partial<Parameters<typeof weightedEdges>[0]>) =>
    weightedEdges({
      derived: [rule],
      ruleWeights: {},
      feedback: [],
      community: [],
      ...input,
    }).map((e) => [e.status, e.raters]);

  it("is suggested when only the rules make the link", () => {
    expect(status({})).toEqual([["suggested", 0]]);
  });

  it("is confirmed when the scoring group keeps at least half the rule's weight", () => {
    expect(status({ feedback: [fb(1, 0)] })).toEqual([["confirmed", 3]]);
  });

  it("is disputed when their feedback cuts it below half", () => {
    // 0.2 × 0.8 = 0.16, under 0.4.
    expect(status({ feedback: [fb(0.2, 0)] })).toEqual([["disputed", 3]]);
  });

  it("is confirmed when they add the same link themselves", () => {
    expect(
      status({
        community: [
          {
            fromCardId: "gen",
            toCardId: "target",
            weight: 0.7,
            ratingCount: 2,
          },
        ],
      }),
    ).toEqual([["confirmed", 2]]);
  });

  it("is the scoring group's own when no rule makes it", () => {
    expect(
      status({
        derived: [],
        community: [
          { fromCardId: "a", toCardId: "b", weight: 0.5, ratingCount: 4 },
        ],
      }),
    ).toEqual([["community", 4]]);
  });
});
