import { describe, expect, it } from "vitest";
import {
  alternatives,
  suggestCore,
  type CoreCandidate,
  type CoreConstraints,
} from "./suggestCore.ts";

// Already in ranked order, as the ranking hands them over.
const ranked: CoreCandidate[] = [
  { variantId: "r1", cardId: "a", pitch: 1, value: 90 },
  { variantId: "b1", cardId: "b", pitch: 3, value: 85 },
  { variantId: "r2", cardId: "c", pitch: 1, value: 80 },
  { variantId: "y1", cardId: "d", pitch: 2, value: 75 },
  { variantId: "r3", cardId: "e", pitch: 1, value: 70 },
  { variantId: "b2", cardId: "f", pitch: 3, value: 65 },
  { variantId: "r4", cardId: "g", pitch: 1, value: 60 },
  { variantId: "n1", cardId: "h", pitch: null, value: 95 },
];

const constraints = (over: Partial<CoreConstraints> = {}): CoreConstraints => ({
  targets: { 1: 6, 2: 3, 3: 3 },
  copiesEach: 3,
  copyLimit: 3,
  locked: new Map(),
  removed: new Set(),
  ...over,
});
const picked = (c: CoreConstraints) =>
  suggestCore(ranked, c).picks.map((p) => `${p.variantId}×${p.quantity}`);
const filled = (c: CoreConstraints) =>
  Object.fromEntries(
    suggestCore(ranked, c).byPitch.map((p) => [p.pitch, p.filled]),
  );

describe("suggestCore", () => {
  it("fills each pitch from the best card down to its target, in ranked order", () => {
    expect(picked(constraints())).toEqual(["r1×3", "b1×3", "r2×3", "y1×3"]);
    expect(filled(constraints())).toEqual({ 1: 6, 2: 3, 3: 3 });
  });

  it("takes only what's left of the target on the last pick", () => {
    expect(picked(constraints({ targets: { 1: 5 } }))).toEqual([
      "r1×3",
      "r2×2",
    ]);
  });

  it("takes fewer copies of each card when asked, so more cards fit", () => {
    expect(picked(constraints({ targets: { 1: 4 }, copiesEach: 2 }))).toEqual([
      "r1×2",
      "r2×2",
    ]);
  });

  it("never goes over the copy limit", () => {
    expect(picked(constraints({ targets: { 1: 4 }, copiesEach: 5 }))).toEqual([
      "r1×3",
      "r2×1",
    ]);
    expect(
      picked(constraints({ targets: {}, locked: new Map([["r4", 9]]) })),
    ).toEqual(["r4×3"]);
  });

  it("keeps locked cards whatever their rank, counting them toward their pitch first", () => {
    const c = constraints({ targets: { 1: 6 }, locked: new Map([["r4", 3]]) });
    expect(picked(c)).toEqual(["r1×3", "r4×3"]);
    expect(
      suggestCore(ranked, c).picks.find((p) => p.variantId === "r4"),
    ).toMatchObject({ locked: true });
  });

  it("keeps locked cards even when they go over the target", () => {
    const c = constraints({
      targets: { 1: 3 },
      locked: new Map([
        ["r3", 3],
        ["r4", 2],
      ]),
    });
    expect(picked(c)).toEqual(["r3×3", "r4×2"]);
    expect(filled(c)[1]).toBe(5);
  });

  it("skips removed cards, so the next best fills in", () => {
    expect(
      picked(constraints({ targets: { 1: 6 }, removed: new Set(["r2"]) })),
    ).toEqual(["r1×3", "r3×3"]);
  });

  it("adds nothing for a pitch without a target, or cards without a pitch", () => {
    expect(picked(constraints({ targets: { 2: 3 } }))).toEqual(["y1×3"]);
  });

  it("says how short a pitch is when there aren't enough cards", () => {
    const s = suggestCore(ranked, constraints({ targets: { 3: 9 } }));
    expect(s.byPitch).toEqual([{ pitch: 3, target: 9, filled: 6 }]);
  });
});

describe("alternatives", () => {
  it("offers the next best cards of the same pitch that aren't picked or removed", () => {
    const c = constraints({ targets: { 1: 6 }, removed: new Set(["r3"]) });
    const s = suggestCore(ranked, c);
    expect(alternatives(ranked, s, c, "r2").map((a) => a.variantId)).toEqual([
      "r4",
    ]);
  });
});
