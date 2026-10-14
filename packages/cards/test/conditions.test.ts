// Checked by the maintainer, 15 Oct 2026 (README "Floor, ceiling and overall"): which cards get floor and ceiling ratings.
// A card has conditions when any recorded effect has a condition, or happens on a hit.
import { describe, expect, it } from "vitest";
import type { CardAttributes } from "../src/attributes.ts";
import { hasConditions } from "../src/conditions.ts";

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

describe("hasConditions", () => {
  it("is false for a card with no conditional effects", () => {
    expect(hasConditions(generated)).toBe(false);
    expect(
      hasConditions({
        ...generated,
        tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
      }),
    ).toBe(false);
  });

  it("is true when an effect has a condition", () => {
    expect(
      hasConditions({
        ...generated,
        tokens: [
          {
            token: "gate",
            amount: 1,
            trigger: "on_play",
            conditions: ["banished_card_is_shadow"],
          },
        ],
      }),
    ).toBe(true);
  });

  it("is true when an effect happens on a hit (a blocked attack doesn't get it)", () => {
    expect(
      hasConditions({
        ...generated,
        arcaneDamage: [{ amount: 1, trigger: "on_hit" }],
      }),
    ).toBe(true);
  });

  it("is true for conditional go again, instant speed or cost reductions", () => {
    expect(
      hasConditions({
        ...generated,
        goAgain: { conditions: ["played_or_created_aura_this_turn"] },
      }),
    ).toBe(true);
    expect(
      hasConditions({
        ...generated,
        costReductions: [{ amount: 6, conditions: ["usurped_this_turn"] }],
      }),
    ).toBe(true);
  });

  it("ignores effects given to a later card without a condition", () => {
    expect(
      hasConditions({
        ...generated,
        conditionalBonuses: [
          { effect: "plus_power", amount: 1, grantedTo: "next_attack_action" },
        ],
      }),
    ).toBe(false);
  });

  it("looks at each pitch's own attributes too", () => {
    expect(
      hasConditions(generated, [
        { arcaneDamage: [{ amount: 1, trigger: "on_hit" }] },
      ]),
    ).toBe(true);
  });
});
