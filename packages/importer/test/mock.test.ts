import { describe, expect, it } from "vitest";
import {
  assertLocalDb,
  mockScores,
  type MockCard,
  type MockScore,
} from "../src/mock.ts";

const attrs = (extra: object = {}) =>
  ({
    groups: [],
    hasUsurp: false,
    canAttack: false,
    hasGoAgain: false,
    hasRuneGate: false,
    hasBloodDebt: false,
    isGateTarget: false,
    specialization: null,
    ...extra,
  }) as MockCard["attributes"];

const pitched = (id: string) =>
  [1, 2, 3].map((pitch) => ({ id: `${id}-${pitch}`, pitch, attributes: {} }));

// 40 Runeblade or Shadow cards and 160 generics, like the real pool's mix.
const cards: MockCard[] = [
  ...Array.from({ length: 40 }, (_, i) => ({
    id: `rb${i}`,
    type: "action",
    classes: i % 2 ? ["Runeblade"] : [],
    talents: i % 2 ? [] : ["Shadow"],
    attributes: attrs(
      i % 3 === 0
        ? {
            tokens: [
              {
                token: "runechant",
                amount: 1,
                trigger: "on_play",
                conditions: ["has_been_gated"],
              },
            ],
          }
        : i % 3 === 1
          ? { hasBloodDebt: true }
          : {},
    ),
    variants: pitched(`rb${i}`),
  })),
  ...Array.from({ length: 160 }, (_, i) => ({
    id: `g${i}`,
    type: i % 10 === 0 ? "equipment" : "attack_action",
    classes: ["Generic"],
    talents: [],
    attributes: attrs(),
    variants:
      i % 10 === 0
        ? [{ id: `g${i}-0`, pitch: null, attributes: {} }]
        : pitched(`g${i}`),
  })),
];
const scorers = ["s1", "s2", "s3", "s4", "s5"];
const run = (seed = 1) => mockScores(cards, scorers, seed);

const isRbOrShadow = (id: string) => id.startsWith("rb");
const cardLevel = (s: MockScore, key: string) =>
  s.variantId === null && s.side === null && s.dimension === key;

describe("mockScores (local development data only)", () => {
  it("is the same for the same seed and different for another", () => {
    expect(run(1)).toEqual(run(1));
    expect(run(2)).not.toEqual(run(1));
  });

  it("only scores on the slider's steps of 10, between 0 and 100", () => {
    for (const s of run().scores) {
      expect(s.score % 10).toBe(0);
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });

  it("only scores cards the scorer reviewed", () => {
    const { reviews, scores } = run();
    const reviewed = new Set(reviews.map((r) => `${r.userId}|${r.cardId}`));
    for (const s of scores)
      expect(reviewed).toContain(`${s.userId}|${s.cardId}`);
  });

  it("gives every review an all-pitches overall, so no pitch counts as 0 by accident", () => {
    const { reviews, scores } = run();
    for (const r of reviews) {
      expect(
        scores.some(
          (s) =>
            s.userId === r.userId &&
            s.cardId === r.cardId &&
            cardLevel(s, "overall"),
        ),
      ).toBe(true);
    }
  });

  it("reviews each covered card by at least 2 scorers, so it can be ranked", () => {
    const counts = new Map<string, number>();
    for (const r of run().reviews)
      counts.set(r.cardId, (counts.get(r.cardId) ?? 0) + 1);
    for (const n of counts.values()) expect(n).toBeGreaterThanOrEqual(2);
  });

  it("rates floor and ceiling only on cards with conditions, around overall", () => {
    const { scores } = run();
    const conditional = new Set(
      cards.filter((c) => "tokens" in c.attributes).map((c) => c.id),
    );
    const ranged = scores.filter((s) => s.dimension !== "overall");
    expect(ranged.length).toBeGreaterThan(0);
    for (const s of ranged) {
      expect(conditional).toContain(s.cardId);
      const overall = scores.find(
        (o) =>
          o.userId === s.userId &&
          o.cardId === s.cardId &&
          cardLevel(o, "overall"),
      )!.score;
      if (s.dimension === "floor") expect(s.score).toBeLessThanOrEqual(overall);
      if (s.dimension === "ceiling")
        expect(s.score).toBeGreaterThanOrEqual(overall);
    }
  });

  it("varies by pitch and by side on some cards, so those settings change the ranking", () => {
    const { scores } = run();
    expect(scores.some((s) => s.variantId !== null)).toBe(true);
    expect(scores.some((s) => s.side !== null)).toBe(true);
  });

  it("covers most Runeblade and Shadow cards and a few generics, leaving some for Needs review", () => {
    const covered = new Set(run().reviews.map((r) => r.cardId));
    const rb = cards.filter((c) => isRbOrShadow(c.id));
    const generic = cards.filter((c) => !isRbOrShadow(c.id));
    const share = (list: MockCard[]) =>
      list.filter((c) => covered.has(c.id)).length / list.length;
    expect(share(rb)).toBeGreaterThan(0.6);
    expect(share(rb)).toBeLessThan(1);
    expect(share(generic)).toBeGreaterThan(0.1);
    expect(share(generic)).toBeLessThan(0.5);
  });

  it("rates Runeblade and Shadow cards higher than generics on average", () => {
    const { scores } = run();
    const mean = (pick: (id: string) => boolean) => {
      const xs = scores
        .filter((s) => cardLevel(s, "overall") && pick(s.cardId))
        .map((s) => s.score);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(mean(isRbOrShadow)).toBeGreaterThan(mean((id) => !isRbOrShadow(id)));
  });
});

describe("assertLocalDb", () => {
  it("allows the local stack", () => {
    expect(() =>
      assertLocalDb("postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
    ).not.toThrow();
    expect(() =>
      assertLocalDb("postgresql://postgres:postgres@localhost:54322/postgres"),
    ).not.toThrow();
  });

  it("refuses any other database, with no override", () => {
    expect(() =>
      assertLocalDb("postgresql://u:p@db.abc.supabase.co:5432/postgres"),
    ).toThrow(/local/);
  });
});
