// The occasional synergy question (the maintainer, 20 Oct 2026): confirming links in a queue is
// too much effort, so one relevant link is asked at a time, picked at random among the most
// preferred: links touching Usurp the Shadow Throne cards first, then Rune Gate cards, then the
// higher-rated cards.
import type { SynergyEdge } from "@vdb/cards";
import { describe, expect, it } from "vitest";
import { nudgeCandidates, pickNudge, type NudgeCard } from "./nudge.ts";
import { pairKey } from "./synergyQueue.ts";

const edge = (from: string, to: string): SynergyEdge => ({
  from,
  to,
  weight: 0.6,
  engine: null,
  reasons: ["gate-feeds-gate-target"],
  traverse: false,
});
const card = (
  name: string,
  over: Partial<NudgeCard> = {},
): [string, NudgeCard] => [
  name,
  { name, firstSet: null, attributes: { hasRuneGate: false }, ...over },
];

const cards = new Map([
  card("old-a"),
  card("old-b"),
  card("new", { firstSet: "Usurp the Shadow Throne" }),
  card("gate", { attributes: { hasRuneGate: true } }),
  card("rated-a"),
  card("rated-b"),
]);
const ratings = new Map([
  ["rated-a", 8],
  ["rated-b", 8],
  ["old-a", 4],
  ["old-b", 4],
]);

describe("nudgeCandidates", () => {
  it("puts Usurp the Shadow Throne links first, then Rune Gate links, then the higher rated", () => {
    const order = nudgeCandidates(
      [
        edge("old-a", "old-b"),
        edge("rated-a", "rated-b"),
        edge("gate", "old-a"),
        edge("old-b", "new"),
      ],
      cards,
      new Set(),
      ratings,
    ).map((e) => `${e.from}>${e.to}`);
    expect(order).toEqual([
      "old-b>new",
      "gate>old-a",
      "rated-a>rated-b",
      "old-a>old-b",
    ]);
  });

  it("leaves out links already answered", () => {
    expect(
      nudgeCandidates(
        [edge("old-a", "old-b"), edge("old-b", "new")],
        cards,
        new Set([pairKey("old-b", "new")]),
        ratings,
      ).map((e) => e.to),
    ).toEqual(["old-b"]);
  });

  it("asks only about the card being viewed, when given one", () => {
    expect(
      nudgeCandidates(
        [edge("old-a", "old-b"), edge("old-b", "new"), edge("gate", "old-a")],
        cards,
        new Set(),
        ratings,
        "old-a",
      ).map((e) => `${e.from}>${e.to}`),
    ).toEqual(["gate>old-a", "old-a>old-b"]);
  });
});

describe("pickNudge", () => {
  const list = ["a", "b", "c", "d", "e"].map((x) => edge(x, "z"));

  it("picks at random among the top few", () => {
    expect(pickNudge(list, () => 0, 3)?.from).toBe("a");
    expect(pickNudge(list, () => 0.99, 3)?.from).toBe("c");
  });

  it("has nothing to ask when there are no links", () => {
    expect(pickNudge([], () => 0.5)).toBeUndefined();
  });
});
