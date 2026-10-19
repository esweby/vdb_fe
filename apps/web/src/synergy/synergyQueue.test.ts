// The confirm-suggestions queue (README "Synergy graph": scorers confirm, reject or reweight
// edges the derived rules propose; docs/synergy-rules.md "Community feedback").
import type { SynergyEdge } from "@vdb/cards";
import { describe, expect, it } from "vitest";
import { feedbackRows, pairKey, synergyQueue } from "./synergyQueue.ts";

const edge = (
  from: string,
  to: string,
  weight: number,
  reasons = ["gate-feeds-gate-target"],
): SynergyEdge => ({
  from,
  to,
  weight,
  engine: "gate",
  reasons,
  traverse: false,
});
const cards = new Map(
  [
    { id: "rb1", name: "Arcane Cussing", classCard: true },
    { id: "rb2", name: "Become the Shadow Lord", classCard: true },
    { id: "rb3", name: "Cull", classCard: true },
    { id: "gen", name: "Belittle", classCard: false },
  ].map((c) => [c.id, c]),
);

describe("synergyQueue", () => {
  it("puts links between Runeblade and Shadow cards first, then the strongest, then by name", () => {
    const queue = synergyQueue(
      [
        edge("gen", "rb1", 0.9),
        edge("rb3", "rb1", 0.6),
        edge("rb2", "rb1", 0.6),
        edge("rb1", "rb3", 0.8),
      ],
      cards,
      new Set(),
    );
    expect(queue.map((e) => `${e.from}→${e.to}`)).toEqual([
      "rb1→rb3",
      "rb2→rb1",
      "rb3→rb1",
      "gen→rb1",
    ]);
  });

  it("leaves out links you've already answered", () => {
    const queue = synergyQueue(
      [edge("rb2", "rb1", 0.6), edge("rb1", "rb3", 0.8)],
      cards,
      new Set([pairKey("rb1", "rb3")]),
    );
    expect(queue.map((e) => `${e.from}→${e.to}`)).toEqual(["rb2→rb1"]);
  });
});

describe("feedbackRows", () => {
  const e = edge("rb2", "rb1", 0.8, [
    "gate-feeds-gate-target",
    "hand-banish-feeds-gate-target",
  ]);

  it("records the verdict for every rule behind the link, so its weight follows the vote", () => {
    expect(feedbackRows(e, "confirm")).toEqual([
      {
        ruleId: "gate-feeds-gate-target",
        fromCardId: "rb2",
        toCardId: "rb1",
        verdict: "confirm",
        weight: null,
      },
      {
        ruleId: "hand-banish-feeds-gate-target",
        fromCardId: "rb2",
        toCardId: "rb1",
        verdict: "confirm",
        weight: null,
      },
    ]);
  });

  it("carries the weight only for a reweight", () => {
    expect(feedbackRows(e, "reweight", 0.3).map((r) => r.weight)).toEqual([
      0.3, 0.3,
    ]);
    expect(feedbackRows(e, "reject").map((r) => r.weight)).toEqual([
      null,
      null,
    ]);
  });
});
