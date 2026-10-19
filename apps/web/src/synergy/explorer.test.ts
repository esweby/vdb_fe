// The synergy explorer (maintainer, 19 Oct 2026): a graph-only tool with a side panel to
// choose what to start from, refine what's drawn, and walk from card to card.
import { describe, expect, it } from "vitest";
import type { WeightedEdge } from "../ranking/synergyCore.ts";
import {
  cardLinks,
  explorerView,
  primaryEngine,
  readExplorerSearch,
  writeExplorerSearch,
  type ExplorerSettings,
} from "./explorer.ts";

const edge = (
  from: string,
  to: string,
  weight: number,
  over: Partial<WeightedEdge> = {},
): WeightedEdge => ({
  from,
  to,
  weight,
  bucket: "gate",
  kind: "rule",
  traverse: false,
  reasons: ["gate-feeds-gate-target"],
  ...over,
});
const cards = ["a", "b", "c", "d", "e", "lonely"].map((id) => ({
  id,
  name: id.toUpperCase(),
  roles: [],
}));
// a → b → c → d, and e helps a through the banish engine; the scoring group links b → e.
const edges = [
  edge("a", "b", 0.8),
  edge("b", "c", 0.6),
  edge("c", "d", 0.9),
  edge("e", "a", 0.4, { bucket: "banish" }),
  edge("b", "e", 0.7, { kind: "community", bucket: "community", reasons: [] }),
];
const settings = (over: Partial<ExplorerSettings> = {}): ExplorerSettings => ({
  start: "all",
  card: undefined,
  engines: [],
  source: "both",
  min: 0,
  ...over,
});
const ids = (v: ReturnType<typeof explorerView>) =>
  v.nodes.map((n) => n.id).sort();

describe("explorerView: where it starts", () => {
  it("everything: every card with a link, leaving out cards with none", () => {
    expect(
      ids(explorerView({ cards, edges, settings: settings(), coreIds: [] })),
    ).toEqual(["a", "b", "c", "d", "e"]);
  });

  // One link out: two pulled in about 100 cards, as the rules link whole groups (19 Oct 2026).
  it("a card: it and the cards linked to it, either way round", () => {
    const view = explorerView({
      cards,
      edges,
      settings: settings({ start: "card", card: "a" }),
      coreIds: [],
    });
    expect(ids(view)).toEqual(["a", "b", "e"]);
    expect(view.nodes.find((n) => n.id === "a")).toMatchObject({
      selected: true,
      distance: 0,
    });
    expect(view.nodes.find((n) => n.id === "b")?.distance).toBe(1);
  });

  it("your core: the core and the cards linked to it", () => {
    const view = explorerView({
      cards,
      edges,
      settings: settings({ start: "core" }),
      coreIds: ["d"],
    });
    expect(ids(view)).toEqual(["c", "d"]);
    expect(view.nodes.find((n) => n.id === "d")?.inCore).toBe(true);
  });

  it("draws only the links between the cards shown", () => {
    const view = explorerView({
      cards,
      edges,
      settings: settings({ start: "core" }),
      coreIds: ["d"],
    });
    expect(view.edges.map((e) => `${e.from}→${e.to}`)).toEqual(["c→d"]);
  });
});

describe("explorerView: refining", () => {
  it("hides links below the minimum strength", () => {
    const view = explorerView({
      cards,
      edges,
      settings: settings({ min: 0.65 }),
      coreIds: [],
    });
    expect(view.edges.map((e) => `${e.from}→${e.to}`)).toEqual([
      "a→b",
      "c→d",
      "b→e",
    ]);
  });

  it("shows only the rules' links, or only the scoring group's", () => {
    const rules = explorerView({
      cards,
      edges,
      settings: settings({ source: "rule" }),
      coreIds: [],
    });
    expect(rules.edges.some((e) => e.kind === "community")).toBe(false);
    const group = explorerView({
      cards,
      edges,
      settings: settings({ source: "community" }),
      coreIds: [],
    });
    expect(group.edges.map((e) => `${e.from}→${e.to}`)).toEqual(["b→e"]);
  });

  it("keeps only the chosen engines' links, plus the scoring group's own", () => {
    const view = explorerView({
      cards,
      edges,
      settings: settings({ engines: ["banish"] }),
      coreIds: [],
    });
    expect(view.edges.map((e) => `${e.from}→${e.to}`)).toEqual(["e→a", "b→e"]);
  });
});

describe("cardLinks", () => {
  it("lists what a card helps and what helps it, strongest first, whatever the filters", () => {
    const links = cardLinks("b", edges);
    expect(links.helps.map((e) => e.to)).toEqual(["e", "c"]);
    expect(links.helpedBy.map((e) => e.from)).toEqual(["a"]);
  });
});

describe("primaryEngine", () => {
  it("is a card's most telling engine, Runechants and auras last, or none", () => {
    expect(primaryEngine(["gate_generator", "hand_banisher"])).toBe("gate");
    // Most Shadow cards make Runechants or auras too; that shouldn't colour them all alike.
    expect(
      primaryEngine(["runechant_generator", "aura_generator", "gate_target"]),
    ).toBe("gate");
    expect(primaryEngine(["aura_generator", "runechant_generator"])).toBe(
      "runechant",
    );
    expect(primaryEngine(["disruption"])).toBeNull();
  });
});

describe("explorer URL state", () => {
  it("starts from everything by default, or from the card in the URL", () => {
    expect(readExplorerSearch({})).toEqual({
      start: "all",
      card: undefined,
      engines: [],
      source: "both",
      min: 0.5,
    });
    expect(readExplorerSearch({ card: "x" }).start).toBe("card");
  });

  it("round-trips, writing only what differs from the defaults", () => {
    const s = settings({
      start: "core",
      engines: ["gate", "banish"],
      source: "rule",
      min: 0.3,
    });
    expect(readExplorerSearch(writeExplorerSearch(s))).toEqual(s);
    expect(writeExplorerSearch(readExplorerSearch({}))).toEqual({});
  });

  it("ignores junk", () => {
    expect(
      readExplorerSearch({
        start: "nope",
        src: "x",
        min: "abc",
        eng: "gate,nope",
      }),
    ).toEqual({
      start: "all",
      card: undefined,
      engines: ["gate"],
      source: "both",
      min: 0.5,
    });
  });
});
