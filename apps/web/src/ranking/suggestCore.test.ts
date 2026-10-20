import { describe, expect, it } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import {
  alternatives,
  offPitchReactions,
  suggestCore,
  suggestGear,
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

  // A Legendary card (e.g. Arknight Shard) is limited to one copy (scoring group, 16 Oct 2026).
  it("takes one copy of a card limited to one, and fills the rest from the next cards", () => {
    const withLegendary = ranked.map((r) =>
      r.variantId === "b1" ? { ...r, limit: 1 } : r,
    );
    expect(
      suggestCore(withLegendary, constraints())
        .picks.filter((p) => p.pitch === 3)
        .map((p) => `${p.variantId}×${p.quantity}`),
    ).toEqual(["b1×1", "b2×2"]);
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

// The maintainer, 20 Oct 2026: "Fate Foreseen blue should probably never be recommended: you'd
// play the red defence reactions over yellow and blue because they cover the 4 breakpoint."
describe("defence reactions", () => {
  it("flags the pitches of a defence reaction below its best defence", () => {
    const fate = sampleCards.find((c) => c.name === "Fate Foreseen")!;
    const withDefences = {
      ...fate,
      variants: fate.variants.map((v, i) => ({ ...v, defense: 4 - i })),
    };
    const hocus = sampleCards.find((c) => c.name === "Hocus Pocus")!;
    expect([...offPitchReactions([withDefences, hocus])].sort()).toEqual([
      "ff2",
      "ff3",
    ]);
  });

  it("aren't suggested at those pitches; the next best card fills in", () => {
    const withBlueReaction: CoreCandidate[] = [
      {
        variantId: "ff3",
        cardId: "ff",
        pitch: 3,
        value: 99,
        notSuggested: true,
      },
      ...ranked,
    ];
    const picks = suggestCore(withBlueReaction, constraints()).picks.map(
      (p) => p.variantId,
    );
    expect(picks).not.toContain("ff3");
    expect(picks).toContain("b1");
    expect(
      alternatives(
        withBlueReaction,
        suggestCore(withBlueReaction, constraints()),
        constraints(),
        "b1",
      ).map((a) => a.variantId),
    ).not.toContain("ff3");
  });
});

// The maintainer, 20 Oct 2026: the core builder can suggest equipment too, as an option.
describe("suggestGear", () => {
  const slots = [
    {
      title: "Weapons",
      cards: [{ variantId: "nebula" }, { variantId: "blade" }],
    },
    { title: "Head", cards: [{ variantId: "hood" }, { variantId: "helm" }] },
    { title: "Chest", cards: [{ variantId: "tunic" }] },
  ];

  it("adds the best of each slot, kept apart from what's already in the core", () => {
    expect(suggestGear(slots, { r1: 3 })).toEqual({
      r1: 3,
      nebula: 1,
      hood: 1,
      tunic: 1,
    });
  });

  // The maintainer, 20 Oct 2026: Grimoire of Fellingsong can't be played alongside Seven Sin
  // Nebula. A two-handed weapon takes both hands, so there's no off-hand to suggest.
  describe("hands", () => {
    const withOffHand = [
      ...slots,
      { title: "Off-Hand", cards: [{ variantId: "grimoire" }] },
    ];
    const twoHanded = new Set(["nebula"]);

    it("suggests no off-hand alongside a two-handed weapon", () => {
      expect(suggestGear(withOffHand, {}, twoHanded)).toEqual({
        nebula: 1,
        hood: 1,
        tunic: 1,
      });
    });

    it("suggests a one-handed weapon when the core already has an off-hand", () => {
      expect(suggestGear(withOffHand, { grimoire: 1 }, twoHanded)).toEqual({
        grimoire: 1,
        blade: 1,
        hood: 1,
        tunic: 1,
      });
    });

    it("suggests the off-hand when the weapon is one-handed", () => {
      expect(suggestGear(withOffHand, { blade: 1 }, twoHanded)).toMatchObject({
        blade: 1,
        grimoire: 1,
      });
    });
  });

  it("leaves a slot alone when the core already has a piece for it", () => {
    expect(suggestGear(slots, { helm: 1 })).toEqual({
      helm: 1,
      nebula: 1,
      tunic: 1,
    });
  });
});
