// Which score dimensions a card does anything for. Dimension keys match score_dimensions.key.
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
const ALL = [
  "runechantCreation",
  "gateCreation",
  "banish",
  "playableFromBanish",
  "enablesTraverse",
  "utility",
];

describe("relevantDimensions", () => {
  it("Become the Shadow Lord: Runechants, Gates, banishing and traverse", () => {
    expect(
      relevantDimensions(ALL, {
        ...generated,
        banishesOwn: [{ from: "hand", trigger: "on_play" }],
        tokens: [
          { token: "runechant", amount: 1, trigger: "on_play" },
          { token: "gate", amount: 1, trigger: "on_play" },
        ],
      }),
    ).toEqual([
      "runechantCreation",
      "gateCreation",
      "banish",
      "enablesTraverse",
      "utility",
    ]);
  });

  it("Abyssal Bite: playable from banish, not Runechants", () => {
    expect(
      relevantDimensions(ALL, {
        ...generated,
        hasBloodDebt: true,
        isGateTarget: true,
        playableFromBanish: {},
      }),
    ).toEqual(["playableFromBanish", "utility"]);
  });

  it("looks at every pitch's attributes", () => {
    expect(
      relevantDimensions(ALL, generated, [
        { tokens: [{ token: "runechant", amount: 3, trigger: "on_attack" }] },
      ]),
    ).toEqual(["runechantCreation", "enablesTraverse", "utility"]);
  });

  it("counts granted tokens and disruption that banishes", () => {
    expect(
      relevantDimensions(ALL, {
        ...generated,
        tokens: [
          {
            token: "gate",
            amount: 1,
            trigger: "on_hit",
            grantedTo: "next_shadow_attack",
          },
        ],
        disrupts: [
          {
            action: "banish",
            from: "hand",
            amount: 1,
            target: "each_hero",
            trigger: "on_play",
          },
        ],
      }),
    ).toEqual(["gateCreation", "banish", "enablesTraverse", "utility"]);
  });

  it("counts cards that enable play from banish for others", () => {
    expect(
      relevantDimensions(ALL, {
        ...generated,
        enablesPlayFromBanish: [{ target: { group: "runechant_aura" } }],
      }),
    ).toContain("playableFromBanish");
  });

  it("shows a plain card only Utility", () => {
    expect(relevantDimensions(ALL, generated)).toEqual(["utility"]);
  });

  it("shows dimensions it doesn't know about", () => {
    expect(relevantDimensions([...ALL, "newDimension"], generated)).toEqual([
      "utility",
      "newDimension",
    ]);
  });
});
