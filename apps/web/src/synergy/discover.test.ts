// Packages and hidden gems (maintainer, 19 Oct 2026; explorer feature 2).
import { describe, expect, it } from "vitest";
import type { WeightedEdge } from "../ranking/synergyCore.ts";
import { cardScores, hiddenGems, packages } from "./discover.ts";

const edge = (
  from: string,
  to: string,
  weight: number,
  reasons: string[],
  kind: WeightedEdge["kind"] = "rule",
): WeightedEdge => ({
  from,
  to,
  weight,
  bucket: kind === "community" ? "community" : "reference",
  kind,
  traverse: false,
  reasons,
  status: kind === "community" ? "community" : "suggested",
  raters: 0,
});
const sins = ["lust", "envy", "greed"];

describe("packages", () => {
  it("groups the cards that name the same cards: a tutor and an enabler for the sinchants", () => {
    const list = packages([
      ...sins.map((s) => edge("sinspeaker", s, 0.6, ["tutor-finds"])),
      ...sins.map((s) => edge("embrace", s, 0.8, ["enables-play-from-banish"])),
    ]);
    expect(list).toEqual([
      {
        id: "sinspeaker",
        referrers: ["sinspeaker", "embrace"],
        targets: sins,
        why: [
          { card: "sinspeaker", rule: "tutor-finds" },
          { card: "embrace", rule: "enables-play-from-banish" },
        ],
      },
    ]);
  });

  it("keeps packages apart when they name different cards", () => {
    const list = packages([
      edge("countdown", "darkest", 0.6, ["tutor-finds"]),
      ...sins.map((s) => edge("embrace", s, 0.8, ["enables-play-from-banish"])),
    ]);
    expect(list.map((p) => p.referrers)).toEqual([["embrace"], ["countdown"]]);
  });

  it("leaves out references to more than 15 cards, which are a group, not a package", () => {
    const many = Array.from({ length: 16 }, (_, i) => `c${i}`);
    expect(
      packages(many.map((c) => edge("arknight", c, 0.6, ["tutor-finds"]))),
    ).toEqual([]);
  });

  it("ignores the role-fit rules, which link whole groups", () => {
    expect(
      packages([edge("gate", "bite", 0.8, ["gate-feeds-gate-target"])]),
    ).toEqual([]);
  });

  it("counts the scoring group's own links", () => {
    expect(packages([edge("a", "b", 0.7, [], "community")])[0]).toMatchObject({
      referrers: ["a"],
      targets: ["b"],
      why: [{ card: "a", rule: "community" }],
    });
  });
});

describe("cardScores", () => {
  const OVERALL = 3;
  const row = (
    cardId: string,
    variantId: string,
    side: "forsaken" | "usurper",
    score: number,
    ratingCount = 3,
  ) => ({
    cardId,
    variantId,
    side,
    dimensionId: OVERALL,
    score,
    ratingCount,
  });

  it("is a card's best pitch, averaged over both sides, from overall only", () => {
    const scores = cardScores(
      [
        row("hp", "hp1", "forsaken", 60),
        row("hp", "hp1", "usurper", 80),
        row("hp", "hp3", "forsaken", 40),
        row("hp", "hp3", "usurper", 40),
        { ...row("hp", "hp1", "forsaken", 100), dimensionId: 1 },
      ],
      OVERALL,
      2,
    );
    expect(scores.get("hp")).toBe(70);
  });

  it("leaves out ratings from too few people", () => {
    const scores = cardScores([row("x", "x1", "forsaken", 90, 1)], OVERALL, 2);
    expect(scores.has("x")).toBe(false);
  });
});

describe("hiddenGems", () => {
  const scores = new Map([
    ["gem", 45],
    ["meh", 50],
    ["star", 85],
    ["good", 72],
    ["fine", 65],
  ]);

  it("finds low-rated cards linked strongly to high-rated ones, most such partners first", () => {
    const gems = hiddenGems(
      [
        edge("gem", "star", 0.8, ["x"]),
        edge("good", "gem", 0.7, ["x"]),
        edge("meh", "star", 0.8, ["x"]),
        // Too weak, and to a card that isn't rated high enough.
        edge("meh", "good", 0.4, ["x"]),
        edge("gem", "fine", 0.9, ["x"]),
      ],
      scores,
    );
    expect(gems).toEqual([
      { id: "gem", score: 45, partners: ["star", "good"], strength: 1.5 },
      { id: "meh", score: 50, partners: ["star"], strength: 0.8 },
    ]);
  });

  it("leaves out cards without a rating, and cards rated well already", () => {
    const gems = hiddenGems(
      [edge("unrated", "star", 0.9, ["x"]), edge("fine", "star", 0.9, ["x"])],
      scores,
    );
    expect(gems).toEqual([]);
  });
});
