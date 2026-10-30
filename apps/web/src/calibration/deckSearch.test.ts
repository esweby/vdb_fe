// The deck-search spike (docs/deck-search-spike.md): swaps that keep a deck legal, turns played
// with blockers spent, and a hill climb that keeps only improvements. UNVERIFIED scoring.
import { describe, expect, it } from "vitest";
import {
  BLOOD_DEBT,
  RUNECHANT,
  type RulesCard,
} from "@esweby/fab-engine/rules";
import { sampleCards } from "../test/fakeCardRepository.ts";
import {
  climb,
  deckCards,
  fill,
  mutate,
  playHoldingBack,
  poolOf,
  summarise,
  type DeckCounts,
  type PoolEntry,
} from "./deckSearch.ts";

const fact = (name: string, overrides: Partial<RulesCard> = {}): RulesCard => ({
  id: name,
  name,
  pitch: 1,
  cost: 0,
  type: "attack_action",
  power: 3,
  goAgain: true,
  traits: [],
  roles: [],
  amounts: {},
  effects: [],
  ...overrides,
});
const entry = (key: string, limit = 3): PoolEntry => ({
  key,
  label: key,
  card: fact(key),
  limit,
});
const pool = [entry("a"), entry("b"), entry("c"), entry("legend", 1)];

describe("poolOf", () => {
  const base = sampleCards[0]!;
  const summary = (name: string, type: string, keywords: string[] = []) => ({
    ...base,
    name,
    type,
    keywords,
    variants: [{ ...base.variants[0]!, id: `${name}-1`, pitch: 1 }],
  });
  it("keeps verified deck cards, with their copy limit", () => {
    const cards = [
      summary("Verified", "action"),
      summary("Legend", "action", ["Legendary"]),
      summary("Unverified", "action"),
      summary("Sword", "weapon"),
      summary("Helm", "equipment"),
    ];
    const verified = new Set(["Verified", "Legend", "Sword", "Helm"]);
    const result = poolOf(cards, (card) =>
      fact(card.name, verified.has(card.name) ? {} : { effects: undefined }),
    );
    expect(result.map((e) => [e.label, e.limit])).toEqual([
      ["Verified (red)", 3],
      ["Legend (red)", 1],
    ]);
  });
});

describe("mutate", () => {
  const deck: DeckCounts = new Map([
    ["a", 3],
    ["b", 3],
    ["legend", 1],
  ]);
  it("keeps the size, the pool and the limits, and changes the deck", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const next = mutate(deck, pool, seed, 2);
      const total = [...next.values()].reduce((n, c) => n + c, 0);
      expect(total).toBe(7);
      for (const [key, copies] of next) {
        const e = pool.find((p) => p.key === key);
        expect(e).toBeDefined();
        expect(copies).toBeGreaterThan(0);
        expect(copies).toBeLessThanOrEqual(e!.limit);
      }
      expect(next).not.toEqual(deck);
    }
  });
  it("is the same for the same seed", () => {
    expect(mutate(deck, pool, 7, 3)).toEqual(mutate(deck, pool, 7, 3));
  });
  it("leaves the input alone", () => {
    const before = new Map(deck);
    mutate(deck, pool, 3, 3);
    expect(deck).toEqual(before);
  });
});

describe("fill", () => {
  it("adds that many copies, within the limits, the same for the same seed", () => {
    const start: DeckCounts = new Map([["a", 2]]);
    const next = fill(start, pool, 5, 4);
    expect([...next.values()].reduce((n, c) => n + c, 0)).toBe(6);
    for (const [key, copies] of next)
      expect(copies).toBeLessThanOrEqual(
        pool.find((p) => p.key === key)!.limit,
      );
    expect(fill(start, pool, 5, 4)).toEqual(next);
    expect(start).toEqual(new Map([["a", 2]]));
  });
});

describe("playHoldingBack", () => {
  const setup = {
    deck: Array.from({ length: 20 }, (_, i) => fact(`Attack ${i}`)),
    triggers: [RUNECHANT, BLOOD_DEBT],
  };
  it("plays the whole hand when nothing is held back", () => {
    const turns = playHoldingBack(setup, 1, { turns: 2, holdBack: 0 });
    expect(turns.map((t) => t.threatened)).toEqual([12, 12]);
  });
  it("spends the held cards blocking, so each turn plays the rest and starts on a full hand", () => {
    const turns = playHoldingBack(setup, 1, { turns: 3, holdBack: 2 });
    expect(turns.map((t) => [t.threatened, t.held, t.handAtStart])).toEqual([
      [6, 2, 4],
      [6, 2, 4],
      [6, 2, 4],
    ]);
  });
});

describe("summarise", () => {
  it("scores each turn's threat with the burst bonuses, averaged", () => {
    const s = summarise([
      [{ threatened: 4 }, { threatened: 9 }],
      [{ threatened: 14 }, { threatened: 0 }],
    ]);
    expect(s.meanThreatened).toBe(6.75);
    expect(s.burst).toBe(0.5);
    expect(s.big).toBe(0.25);
    expect(s.brick).toBe(0.5);
    // (4 + 13 + 22 + 0) / 4
    expect(s.score).toBe(9.75);
  });
});

describe("climb", () => {
  it("keeps only improvements and records each accepted step", async () => {
    // Score: copies of "c". A swap that adds a "c" is an improvement.
    const evaluate = async (deck: DeckCounts) => deck.get("c") ?? 0;
    const start: DeckCounts = new Map([
      ["a", 3],
      ["b", 3],
    ]);
    const result = await climb(start, pool, evaluate, { steps: 200, seed: 1 });
    expect(result.best.get("c")).toBe(3);
    expect(result.score).toBe(3);
    const scores = result.history.map((h) => h.score);
    expect(scores).toEqual([...scores].sort((x, y) => x - y));
    expect(new Set(scores).size).toBe(scores.length);
  });
  it("keeps a swap only if it beats the best by the margin", async () => {
    const evaluate = async (deck: DeckCounts) => (deck.get("c") ?? 0) * 0.1;
    const start: DeckCounts = new Map([["a", 3]]);
    const result = await climb(start, pool, evaluate, {
      steps: 100,
      seed: 1,
      maxSwaps: 1,
      margin: 0.2,
    });
    expect(result.history).toHaveLength(1);
  });
});

describe("deckCards", () => {
  it("lists one rules card per copy", () => {
    const cards = deckCards(
      new Map([
        ["a", 2],
        ["legend", 1],
      ]),
      pool,
    );
    expect(cards.map((c) => c.name)).toEqual(["a", "a", "legend"]);
  });
});
