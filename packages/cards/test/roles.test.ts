// Roles and engines, first pass (docs/roles.md). UNVERIFIED: for the maintainer to correct.
import { describe, expect, it } from "vitest";
import type {
  AuthoredCardAttributes,
  CardAttributes,
} from "../src/attributes.ts";
import { fits, ROLES, rolesOf, type RoleCard } from "../src/roles.ts";

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
const card = (
  attributes: Partial<CardAttributes> = {},
  type = "action",
  variants: Partial<AuthoredCardAttributes>[] = [],
): RoleCard => ({
  type,
  attributes: { ...generated, ...attributes },
  variantAttributes: variants,
});
const runechants = (amount: number | "X", extra = {}) => ({
  tokens: [
    {
      token: "runechant" as const,
      amount,
      trigger: "on_play" as const,
      ...extra,
    },
  ],
});

describe("rolesOf: Runechant engine", () => {
  it("a card that creates Runechants is a Runechant generator", () => {
    expect(rolesOf(card(runechants(1)))).toEqual(["runechant_generator"]);
  });

  it("creating X or 3 or more at once is also a burst", () => {
    expect(rolesOf(card(runechants("X")))).toEqual([
      "runechant_generator",
      "runechant_burst",
    ]);
    expect(rolesOf(card(runechants(3)))).toContain("runechant_burst");
    expect(rolesOf(card(runechants(2)))).not.toContain("runechant_burst");
  });

  it("giving Runechant creation to a later attack is a granter, not a generator", () => {
    expect(
      rolesOf(
        card(runechants(3, { grantedTo: "next_runeblade_attack_action" })),
      ),
    ).toEqual(["runechant_granter"]);
  });

  it("finds a Runechant generator from a pitch's own attributes", () => {
    expect(rolesOf(card({}, "action", [runechants(1)]))).toEqual([
      "runechant_generator",
    ]);
  });

  it("Rune Gate, Runechant discounts and arcane conditions are payoffs", () => {
    expect(rolesOf(card({ hasRuneGate: true }))).toEqual(["rune_gate"]);
    expect(rolesOf(card({ costReducedPerRunechant: true }))).toEqual([
      "runechant_discount",
    ]);
    expect(
      rolesOf(
        card({
          costReductions: [
            { amount: "per_runechant", grantedTo: "next_attack_action" },
          ],
        }),
      ),
    ).toEqual(["runechant_discount"]);
    expect(
      rolesOf(
        card({
          conditionalBonuses: [
            {
              effect: "plus_power",
              amount: 2,
              conditions: ["dealt_arcane_damage_this_turn"],
            },
          ],
        }),
      ),
    ).toEqual(["arcane_payoff"]);
  });

  it("a weapon that attacks fires Runechants", () => {
    expect(rolesOf(card({ canAttack: true }, "weapon"))).toEqual([
      "runechant_trigger",
    ]);
  });
});

describe("rolesOf: Gate engine", () => {
  it("creating a Gate makes a Gate generator", () => {
    expect(
      rolesOf(
        card({ tokens: [{ token: "gate", amount: 1, trigger: "on_play" }] }),
      ),
    ).toEqual(["gate_generator"]);
  });

  it("a Gate target counts as a generator too (maintainer, 15 Oct 2026)", () => {
    expect(rolesOf(card({ isGateTarget: true }))).toEqual(["gate_target"]);
    expect(ROLES.find((r) => r.id === "gate_target")).toMatchObject({
      engine: "gate",
      kind: "generator",
    });
  });

  it("getting better from banish is a Gate payoff, still to be decided", () => {
    expect(rolesOf(card({ rewardsPlayFromBanish: true }))).toEqual([
      "banish_play_payoff",
    ]);
  });
});

describe("rolesOf: Banish engine", () => {
  it("banishing from hand, deck or graveyard, or itself, are generators", () => {
    expect(rolesOf(card({ groups: ["banishes_from_hand"] }))).toEqual([
      "hand_banisher",
    ]);
    expect(
      rolesOf(card({ banishesOwn: [{ from: "deck_top", trigger: "on_hit" }] })),
    ).toEqual(["deck_banisher"]);
    expect(
      rolesOf(card({ banishesSelf: [{ trigger: "would_go_to_graveyard" }] })),
    ).toEqual(["self_banisher"]);
  });

  it("playing from banish, caring what was banished, and triggering when banished are payoffs", () => {
    expect(rolesOf(card({ playableFromBanish: {} }))).toEqual([
      "plays_from_banish",
    ]);
    expect(rolesOf(card({ groups: ["rewards_shadow_banish"] }))).toEqual([
      "banish_type_payoff",
    ]);
    expect(rolesOf(card({ groups: ["triggers_when_banished"] }))).toEqual([
      "banish_trigger",
    ]);
  });
});

describe("rolesOf: outside the engines", () => {
  it("records go again, Eloquence, sinchants, usurp, disruption and tutors", () => {
    expect(rolesOf(card({ grantsGoAgain: "next_attack_action" }))).toEqual([
      "go_again_granter",
    ]);
    expect(
      rolesOf(
        card({
          tokens: [{ token: "eloquence", amount: 1, trigger: "on_play" }],
        }),
      ),
    ).toEqual(["eloquence"]);
    expect(rolesOf(card({ groups: ["runechant_aura"] }))).toEqual(["sinchant"]);
    expect(rolesOf(card({ hasUsurp: true }))).toEqual(["usurp"]);
    expect(
      rolesOf(
        card({
          disrupts: [
            {
              action: "discard",
              from: "hand",
              amount: 1,
              target: "opponent",
              trigger: "on_hit",
            },
          ],
        }),
      ),
    ).toEqual(["disruption"]);
    expect(
      rolesOf(
        card({
          tutors: [
            {
              target: { group: "runechant_aura" },
              to: "arena",
              trigger: "on_play",
            },
          ],
        }),
      ),
    ).toEqual(["tutor"]);
    for (const id of ["go_again_granter", "sinchant", "usurp"]) {
      expect(ROLES.find((r) => r.id === id)?.engine).toBeNull();
    }
  });

  it("a card with none of these has no roles", () => {
    expect(rolesOf(card())).toEqual([]);
  });
});

describe("fits", () => {
  it("a generator fits a payoff of the same engine, either way round", () => {
    expect(fits(["runechant_generator"], ["rune_gate"])).toBe(true);
    expect(fits(["rune_gate"], ["runechant_burst"])).toBe(true);
    expect(fits(["gate_generator"], ["banish_play_payoff"])).toBe(true);
    expect(fits(["hand_banisher"], ["plays_from_banish"])).toBe(true);
  });

  it("Gate generators and Gate targets fit each other", () => {
    expect(fits(["gate_generator"], ["gate_target"])).toBe(true);
  });

  it("a support fits its engine's generators", () => {
    expect(fits(["runechant_trigger"], ["runechant_generator"])).toBe(true);
    expect(fits(["runechant_trigger"], ["rune_gate"])).toBe(false);
  });

  it("doesn't link across engines, two payoffs, or roles outside the engines", () => {
    expect(fits(["runechant_generator"], ["plays_from_banish"])).toBe(false);
    expect(fits(["rune_gate"], ["arcane_payoff"])).toBe(false);
    expect(fits(["runechant_generator"], ["runechant_burst"])).toBe(false);
    expect(fits(["usurp"], ["gate_target"])).toBe(false);
  });
});
