// The synergy graph (README "Phase Two" step 2): the core and the cards nearest to it, with
// the rules' links and the scoring group's drawn differently.
import type { SynergyEdge } from "@vdb/cards";
import { describe, expect, it } from "vitest";
import { graphView } from "./graphView.ts";
import { weightedEdges } from "./synergyCore.ts";

const derived = (
  from: string,
  to: string,
  weight: number,
  traverse = false,
): SynergyEdge => ({
  from,
  to,
  weight,
  engine: "gate",
  // Not a real rule, so each link keeps the weight given here.
  reasons: ["test-rule"],
  traverse,
});
const names = new Map(
  ["core1", "core2", "near1", "near2", "near3", "far"].map((id) => [
    id,
    id.toUpperCase(),
  ]),
);
const edges = (
  community: { fromCardId: string; toCardId: string; weight: number }[] = [],
) =>
  weightedEdges({
    derived: [
      derived("core1", "core2", 0.8, true),
      derived("near1", "core1", 0.8),
      derived("near2", "core1", 0.3),
      derived("near3", "core2", 0.5),
      derived("far", "near1", 0.9),
    ],
    ruleWeights: {},
    feedback: [],
    community,
  });

describe("weightedEdges", () => {
  it("says which links come from the rules, the scoring group, or both", () => {
    const list = weightedEdges({
      derived: [derived("a", "b", 0.8)],
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

describe("graphView", () => {
  it("is empty without a core", () => {
    expect(graphView({ coreCardIds: [], edges: edges(), names })).toEqual({
      nodes: [],
      links: [],
    });
  });

  it("shows the core and the cards most strongly linked to it, up to a limit", () => {
    const view = graphView({
      coreCardIds: ["core1", "core2"],
      edges: edges(),
      names,
      near: 2,
    });
    expect(view.nodes.map((n) => [n.id, n.inCore])).toEqual([
      ["core1", true],
      ["core2", true],
      ["near1", false],
      ["near3", false],
    ]);
  });

  it("draws only the links between cards it shows, keeping kind and traverse", () => {
    const view = graphView({
      coreCardIds: ["core1", "core2"],
      edges: edges([{ fromCardId: "near3", toCardId: "core1", weight: 0.6 }]),
      names,
      near: 2,
    });
    expect(
      view.links.map(
        (l) =>
          `${l.from}→${l.to} ${l.weight} ${l.kind}${l.traverse ? " traverse" : ""}`,
      ),
    ).toEqual([
      "core1→core2 0.8 rule traverse",
      "near1→core1 0.8 rule",
      "near3→core2 0.5 rule",
      "near3→core1 0.6 community",
    ]);
  });

  // A chord layout: one circle, labels outside it, so a real core stays readable.
  it("puts every card on one circle, the core together on one arc", () => {
    const view = graphView({
      coreCardIds: ["core1", "core2"],
      edges: edges(),
      names,
      near: 2,
    });
    const radii = new Set(
      view.nodes.map((n) => Math.round(Math.hypot(n.x, n.y) * 100) / 100),
    );
    expect(radii.size).toBe(1);
    // Clockwise from the top: the core first, then the near cards.
    expect(
      [...view.nodes].sort((a, b) => a.angle - b.angle).map((n) => n.id),
    ).toEqual(["core1", "core2", "near1", "near3"]);
  });
});
