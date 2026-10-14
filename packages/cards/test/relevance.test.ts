// Which ratings a scorer is asked for (README "Floor, ceiling and overall").
import { describe, expect, it } from "vitest";
import type { CardAttributes } from "../src/attributes.ts";
import { relevantDimensions } from "../src/relevance.ts";

const generated: CardAttributes = {
  hasGoAgain: false,
  hasBloodDebt: false,
  hasUsurp: false,
  hasRuneGate: false,
  isGateTarget: false,
  canAttack: false,
  groups: [],
  specialization: null,
};
const ALL = ["floor", "ceiling", "overall"];

describe("relevantDimensions", () => {
  it("asks only overall when the card has no conditions", () => {
    expect(relevantDimensions(ALL, generated)).toEqual(["overall"]);
  });

  it("asks floor, ceiling and overall when the card has conditions", () => {
    expect(
      relevantDimensions(ALL, {
        ...generated,
        arcaneDamage: [{ amount: 1, trigger: "on_hit" }],
      }),
    ).toEqual(ALL);
  });

  it("shows dimensions it has no rule for", () => {
    expect(relevantDimensions(["overall", "other"], generated)).toEqual([
      "overall",
      "other",
    ]);
  });
});
