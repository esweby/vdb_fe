import { describe, expect, it } from "vitest";
import { banishPlayRoutes } from "../src/routes.ts";

const generated = {
  hasGoAgain: false,
  hasBloodDebt: false,
  hasUsurp: false,
  hasRuneGate: false,
  isGateTarget: false,
  groups: [],
  specialization: null,
};

describe("banishPlayRoutes", () => {
  it("lists every way a card can be played from banish", () => {
    expect(
      banishPlayRoutes({ ...generated, hasRuneGate: true, isGateTarget: true }),
    ).toEqual(["gate", "rune_gate"]);
    expect(
      banishPlayRoutes({
        ...generated,
        playableFromBanish: {},
        isGateTarget: true,
      }),
    ).toEqual(["own_text", "gate"]);
  });

  it("returns nothing for a card that can't be played from banish", () => {
    expect(banishPlayRoutes(generated)).toEqual([]);
  });
});
