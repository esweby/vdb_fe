import { describe, expect, it } from "vitest";
import { authoredAttributesSchema } from "../src/attributes.ts";

describe("authoredAttributesSchema", () => {
  it("accepts Become the Shadow Lord", () => {
    const result = authoredAttributesSchema.safeParse({
      banishesOwn: [{ from: "hand", trigger: "on_play" }],
      tokens: [
        {
          token: "runechant",
          amount: 1,
          trigger: "on_play",
          conditions: ["banished_card_is_runeblade"],
        },
        {
          token: "gate",
          amount: 1,
          trigger: "on_play",
          conditions: ["banished_card_is_shadow"],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a variable amount", () => {
    expect(
      authoredAttributesSchema.safeParse({
        tokens: [{ token: "runechant", amount: "X", trigger: "on_hit" }],
      }).success,
    ).toBe(true);
  });

  it("accepts effects granted to your next attack", () => {
    expect(
      authoredAttributesSchema.safeParse({
        tokens: [
          {
            token: "runechant",
            amount: 3,
            trigger: "on_hit",
            grantedTo: "next_runeblade_attack_action",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts triggers from your other attacks and the attack-action condition", () => {
    expect(
      authoredAttributesSchema.safeParse({
        tokens: [
          {
            token: "runechant",
            amount: 1,
            trigger: "your_attack_action_played",
          },
          { token: "runechant", amount: 2, trigger: "your_attack_action_hits" },
          {
            token: "runechant",
            amount: 4,
            trigger: "on_play",
            conditions: [
              "played_attack_action_this_turn",
              "played_non_attack_action_this_turn",
            ],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts cards that banish themselves", () => {
    expect(
      authoredAttributesSchema.safeParse({
        banishesSelf: [
          { trigger: "would_go_to_graveyard" },
          { trigger: "activated" },
          { trigger: "combat_chain_closes", optional: true },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts disruption and conditional instant speed", () => {
    expect(
      authoredAttributesSchema.safeParse({
        disrupts: [
          {
            action: "banish",
            from: "hand",
            amount: 1,
            target: "each_hero",
            trigger: "on_play",
          },
          {
            action: "banish",
            from: "arsenal",
            amount: "all",
            target: "defending_hero",
            trigger: "on_hit",
          },
          {
            action: "discard",
            from: "hand",
            amount: 1,
            target: "defending_hero",
            trigger: "on_hit",
            conditions: ["dealt_arcane_damage_this_turn"],
          },
          {
            action: "destroy",
            from: "auras",
            amount: 1,
            target: "defending_hero",
            trigger: "on_hit",
            optional: true,
          },
        ],
        instantSpeed: { conditions: ["hero_lost_life_this_turn"] },
      }).success,
    ).toBe(true);
  });

  it("accepts tutors and play-from-banish enablers that reference groups or cards", () => {
    expect(
      authoredAttributesSchema.safeParse({
        tutors: [
          {
            target: { group: "runechant_aura" },
            to: "arena",
            trigger: "on_attack",
            conditions: ["played_from_banish"],
            optional: true,
          },
          {
            target: { card: "Darkest Hour" },
            to: "banished",
            trigger: "on_hit",
          },
        ],
        enablesPlayFromBanish: [{ target: { group: "runechant_aura" } }],
      }).success,
    ).toBe(true);
  });

  it("accepts conditional cost reductions", () => {
    expect(
      authoredAttributesSchema.safeParse({
        costReductions: [
          { amount: 6, conditions: ["usurped_this_turn"] },
          { amount: 2, conditions: ["played_from_banish"] },
        ],
        playableFromBanish: { conditions: ["usurped_this_turn"] },
      }).success,
    ).toBe(true);
  });

  it("accepts a cost reduction granted to your next attack", () => {
    expect(
      authoredAttributesSchema.safeParse({
        costReductions: [{ amount: "X", grantedTo: "next_attack_action" }],
      }).success,
    ).toBe(true);
  });

  it("accepts equipment patterns", () => {
    expect(
      authoredAttributesSchema.safeParse({
        oneUse: true,
        turnsBanishedFaceDown: [
          { which: "blood_debt", amount: 1, trigger: "activated" },
        ],
        banishesSelf: [{ trigger: "would_be_dealt_damage", optional: true }],
        grantsGoAgain: "target_attack_action",
        disrupts: [
          {
            action: "discard",
            from: "hand",
            amount: 1,
            target: "attacking_hero",
            trigger: "on_defend",
          },
        ],
        arcaneDamage: [
          {
            amount: 1,
            trigger: "on_hit",
            conditions: ["played_card_from_banish_this_turn"],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts conditional bonuses", () => {
    expect(
      authoredAttributesSchema.safeParse({
        conditionalBonuses: [
          {
            effect: "plus_power",
            amount: 2,
            conditions: ["banished_card_is_shadow"],
          },
          { effect: "dominate", conditions: ["banished_card_is_shadow"] },
          {
            effect: "plus_defense",
            amount: 1,
            conditions: ["banished_a_card"],
          },
          {
            effect: "draw",
            amount: 1,
            conditions: ["banished_card_is_shadow"],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts cards a card works with", () => {
    expect(
      authoredAttributesSchema.safeParse({
        supports: [{ target: { group: "rune_gate" } }],
      }).success,
    ).toBe(true);
  });

  it("accepts conditional and granted go again", () => {
    expect(
      authoredAttributesSchema.safeParse({
        goAgain: { conditions: ["banished_card_is_shadow"] },
        grantsGoAgain: "next_runeblade_attack_action",
      }).success,
    ).toBe(true);
    expect(
      authoredAttributesSchema.safeParse({ rewardsPlayFromBanish: true })
        .success,
    ).toBe(true);
  });

  it.each([
    ["an unknown grantsGoAgain", { grantsGoAgain: "every_card" }],
    ["go again without a condition", { goAgain: {} }],
    [
      "granted go again with an empty condition list",
      {
        grantsGoAgain: { to: "next_runeblade_attack_action", conditions: [] },
      },
    ],
    [
      "a bonus with neither a condition nor a grantedTo",
      { conditionalBonuses: [{ effect: "overpower" }] },
    ],
    [
      "a conditional bonus without a condition",
      { conditionalBonuses: [{ effect: "dominate" }] },
    ],
    [
      "a power bonus without an amount",
      {
        conditionalBonuses: [
          { effect: "plus_power", conditions: ["banished_card_is_shadow"] },
        ],
      },
    ],
    [
      "a cost reduction without a condition",
      { costReductions: [{ amount: 2 }] },
    ],
    [
      "an unknown card group",
      { enablesPlayFromBanish: [{ target: { group: "sinchants" } }] },
    ],
    [
      "a reference to both a group and a card",
      {
        enablesPlayFromBanish: [
          { target: { group: "runechant_aura", card: "Runechant of Lust" } },
        ],
      },
    ],
    ["instant speed without a condition", { instantSpeed: {} }],
    [
      "an unknown disruption target",
      {
        disrupts: [
          {
            action: "banish",
            from: "hand",
            amount: 1,
            target: "everyone",
            trigger: "on_play",
          },
        ],
      },
    ],
    [
      "discarding from somewhere other than hand",
      {
        disrupts: [
          {
            action: "discard",
            from: "arsenal",
            amount: 1,
            target: "defending_hero",
            trigger: "on_hit",
          },
        ],
      },
    ],
    [
      "destroying something other than auras",
      {
        disrupts: [
          {
            action: "destroy",
            from: "hand",
            amount: 1,
            target: "defending_hero",
            trigger: "on_hit",
          },
        ],
      },
    ],
    ["go again with an empty condition list", { goAgain: { conditions: [] } }],
    ["an unknown key inside goAgain", { goAgain: { always: true } }],
    [
      "an unknown grantedTo",
      {
        tokens: [
          {
            token: "runechant",
            amount: 1,
            trigger: "on_hit",
            grantedTo: "any_card",
          },
        ],
      },
    ],
    ["an unknown key", { canBanishFromHand: true }],
    [
      "an unknown token",
      { tokens: [{ token: "aura", amount: 1, trigger: "on_play" }] },
    ],
    [
      "an unknown trigger",
      { tokens: [{ token: "runechant", amount: 1, trigger: "whenever" }] },
    ],
    [
      "an unknown condition",
      {
        tokens: [
          {
            token: "runechant",
            amount: 1,
            trigger: "on_play",
            conditions: ["maybe"],
          },
        ],
      },
    ],
    [
      "a zero amount",
      { tokens: [{ token: "runechant", amount: 0, trigger: "on_play" }] },
    ],
    [
      "a fractional amount",
      { arcaneDamage: [{ amount: 1.5, trigger: "on_attack" }] },
    ],
    [
      "an unknown banish zone",
      { banishesOwn: [{ from: "soul", trigger: "on_play" }] },
    ],
    [
      "an unknown key inside an effect",
      {
        tokens: [
          { token: "runechant", amount: 1, trigger: "on_play", extra: 1 },
        ],
      },
    ],
  ])("rejects %s", (_label, value) => {
    expect(authoredAttributesSchema.safeParse(value).success).toBe(false);
  });
});

describe("roles corrections", () => {
  it("accepts roles to add and remove by hand", () => {
    expect(
      authoredAttributesSchema.safeParse({
        roles: { add: ["banish_trigger"], remove: ["gate_target"] },
      }).success,
    ).toBe(true);
  });

  it("rejects a role that doesn't exist", () => {
    expect(
      authoredAttributesSchema.safeParse({ roles: { add: ["gate_maker"] } })
        .success,
    ).toBe(false);
  });
});
