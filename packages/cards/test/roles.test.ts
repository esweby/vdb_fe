// Roles and engines, first pass (docs/roles.md). UNVERIFIED: for the maintainer to correct.
import { describe, expect, it } from "vitest";
import type {
  AuthoredCardAttributes,
  CardAttributes,
} from "../src/attributes.ts";
import { attributeGroups } from "../src/groups.ts";
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
  subtypes: string[] = [],
): RoleCard => ({
  type,
  subtypes,
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

// The maintainer, 20 Oct 2026: "Sinspeaker Gloomblade doesn't need a gate to be played from
// banish". A blood debt action that can already be played from banish isn't a Gate target.
describe("rolesOf: Gate targets", () => {
  const bloodDebtAction = (extra: Partial<CardAttributes> = {}) =>
    card({ hasBloodDebt: true, isGateTarget: true, ...extra }, "attack_action");

  it("is a blood debt action card that can't be played from banish otherwise", () => {
    expect(rolesOf(bloodDebtAction())).toContain("gate_target");
  });

  it("isn't one when it can be played from banish anyway", () => {
    expect(rolesOf(bloodDebtAction({ playableFromBanish: {} }))).not.toContain(
      "gate_target",
    );
  });

  it("still is when playing it from banish needs a condition", () => {
    expect(
      rolesOf(
        bloodDebtAction({
          playableFromBanish: { conditions: ["dealt_arcane_damage_this_turn"] },
        }),
      ),
    ).toContain("gate_target");
  });
});

describe("rolesOf: Runechant engine", () => {
  it("a card that creates Runechants is a Runechant generator", () => {
    expect(rolesOf(card(runechants(1)))).toContain("runechant_generator");
  });

  // The maintainer, 20 Oct 2026: cards that make Runechants turn after turn, for the core builder.
  it("an aura or start-of-turn card making Runechants again and again makes them every turn", () => {
    const malefic = card(
      {
        tokens: [
          {
            token: "runechant",
            amount: 3,
            trigger: "your_attack_action_played",
          },
        ],
      },
      "action",
      [],
      ["Aura"],
    );
    const blessing = card({
      tokens: [{ token: "runechant", amount: 1, trigger: "start_of_turn" }],
    });
    // Promise of Power: the same trigger, but only this turn; not an aura.
    const promise = card({
      tokens: [
        { token: "runechant", amount: 2, trigger: "your_attack_action_played" },
      ],
    });
    const onPlay = card({
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
    });
    expect(rolesOf(malefic)).toContain("runechant_every_turn");
    expect(rolesOf(blessing)).toContain("runechant_every_turn");
    expect(rolesOf(promise)).not.toContain("runechant_every_turn");
    expect(rolesOf(onPlay)).not.toContain("runechant_every_turn");
  });

  it("creating X or 3 or more at once is also a burst", () => {
    expect(rolesOf(card(runechants("X")))).toEqual(
      expect.arrayContaining(["runechant_generator", "runechant_burst"]),
    );
    expect(rolesOf(card(runechants(3)))).toContain("runechant_burst");
    expect(rolesOf(card(runechants(2)))).not.toContain("runechant_burst");
  });

  it("giving Runechant creation to a later attack is a granter, not a generator", () => {
    const roles = rolesOf(
      card(runechants(3, { grantedTo: "next_runeblade_attack_action" })),
    );
    expect(roles).toContain("runechant_granter");
    expect(roles).not.toContain("runechant_generator");
  });

  it("finds a Runechant generator from a pitch's own attributes", () => {
    expect(rolesOf(card({}, "action", [runechants(1)]))).toContain(
      "runechant_generator",
    );
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

  it("attack action cards fire Runechants too (maintainer, 15 Oct 2026)", () => {
    expect(rolesOf(card({}, "attack_action"))).toEqual(["runechant_trigger"]);
    expect(rolesOf(card({}, "weapon"))).toEqual([]);
  });
});

describe("rolesOf: Gate engine", () => {
  it("creating a Gate makes a Gate generator", () => {
    expect(
      rolesOf(
        card({ tokens: [{ token: "gate", amount: 1, trigger: "on_play" }] }),
      ),
    ).toContain("gate_generator");
  });

  it("a Gate target is the Gate engine's payoff: a Gate plays it out of banish (maintainer, 15 Oct 2026)", () => {
    expect(rolesOf(card({ isGateTarget: true }))).toEqual(["gate_target"]);
    expect(ROLES.find((r) => r.id === "gate_target")).toMatchObject({
      engine: "gate",
      kind: "payoff",
    });
  });

  it("getting better from banish is a Gate payoff too", () => {
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
    // Fallen Herald: "Banish this from your hand" banishes itself, not other cards (20 Oct 2026).
    const herald = card({
      banishesSelf: [{ from: "hand", trigger: "activated" }],
    });
    expect(
      rolesOf({
        ...herald,
        attributes: {
          ...herald.attributes,
          groups: attributeGroups({
            banishesSelf: [{ from: "hand", trigger: "activated" }],
          }),
        },
      }),
    ).toEqual(["self_banisher"]);
  });

  // The maintainer, 21 Oct 2026: "Base of the Mountain banishes a card and then it goes as a
  // defending card and to the graveyard." A temporary banish leaves nothing in the banished zone.
  it("a card whose banishes from hand are all temporary isn't a hand banisher", () => {
    const banishesOwn = [
      {
        from: "hand" as const,
        amount: "any" as const,
        which: "action" as const,
        trigger: "on_defend" as const,
        optional: true,
        temporary: true,
      },
    ];
    expect(
      rolesOf(
        card(
          { banishesOwn, groups: attributeGroups({ banishesOwn }) },
          "equipment",
        ),
      ),
    ).not.toContain("hand_banisher");
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

describe("rolesOf: Aura engine", () => {
  it("creating any token makes an aura: Runechants, Gates and Eloquence are all aura tokens", () => {
    expect(rolesOf(card(runechants(1)))).toContain("aura_generator");
    expect(
      rolesOf(
        card({ tokens: [{ token: "gate", amount: 1, trigger: "on_play" }] }),
      ),
    ).toContain("aura_generator");
  });

  it("playing an Aura card makes an aura", () => {
    expect(rolesOf(card({}, "action", [], ["Aura"]))).toEqual([
      "aura_generator",
    ]);
  });

  it("sinchants are aura generators of their own", () => {
    expect(rolesOf(card({ groups: ["runechant_aura"] }))).toEqual(["sinchant"]);
    expect(ROLES.find((r) => r.id === "sinchant")).toMatchObject({
      engine: "aura",
      kind: "generator",
    });
  });

  it("cards that care about auras played, created or destroyed are payoffs", () => {
    expect(
      rolesOf(
        card({
          conditionalBonuses: [
            {
              effect: "plus_power",
              amount: 1,
              conditions: ["played_or_created_aura_this_turn"],
            },
          ],
        }),
      ),
    ).toEqual(["aura_payoff"]);
    expect(
      rolesOf(
        card({
          arcaneDamage: [
            {
              amount: 1,
              trigger: "on_play",
              conditions: ["destroyed_own_aura"],
            },
          ],
        }),
      ),
    ).toEqual(["aura_payoff"]);
  });
});

describe("rolesOf: Tempo engine", () => {
  it("go again and Eloquence are generators", () => {
    expect(rolesOf(card({ grantsGoAgain: "next_attack_action" }))).toEqual([
      "go_again_granter",
    ]);
    expect(
      rolesOf(
        card({
          tokens: [{ token: "eloquence", amount: 1, trigger: "on_play" }],
        }),
      ),
    ).toEqual(["aura_generator", "eloquence"]);
  });

  it("cards that need an action card played earlier in the turn are payoffs", () => {
    expect(
      rolesOf(
        card({
          goAgain: { conditions: ["played_non_attack_action_this_turn"] },
        }),
      ),
    ).toEqual(["tempo_payoff"]);
  });
});

describe("rolesOf: Usurp engine", () => {
  it("cards with Usurp are generators", () => {
    expect(rolesOf(card({ hasUsurp: true }))).toEqual(["usurp"]);
    expect(ROLES.find((r) => r.id === "usurp")).toMatchObject({
      engine: "usurp",
      kind: "generator",
    });
  });

  it("cards that reward being usurped, or usurping this turn, are payoffs", () => {
    expect(
      rolesOf(
        card({
          groups: ["runechant_aura"],
          tokens: [{ token: "runechant", amount: 1, trigger: "on_usurped" }],
        }),
      ),
    ).toContain("usurp_payoff");
    expect(
      rolesOf(
        card({
          costReductions: [{ amount: 6, conditions: ["usurped_this_turn"] }],
        }),
      ),
    ).toEqual(["usurp_payoff"]);
  });

  it("Usurp cards fit what rewards usurping", () => {
    expect(fits(["usurp"], ["usurp_payoff"])).toBe(true);
  });
});

describe("rolesOf: outside the engines", () => {
  it("records disruption and tutors without linking them", () => {
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
    for (const id of ["disruption", "tutor"]) {
      expect(ROLES.find((r) => r.id === id)?.engine).toBeNull();
    }
  });

  it("a card with none of these has no roles", () => {
    expect(rolesOf(card())).toEqual([]);
  });
});

describe("rolesOf: corrections by hand", () => {
  it("adds and removes roles the rules get wrong", () => {
    expect(
      rolesOf(
        card({
          isGateTarget: true,
          roles: { add: ["banish_trigger"], remove: ["gate_target"] },
        }),
      ),
    ).toEqual(["banish_trigger"]);
  });

  it("takes corrections from a pitch's own attributes", () => {
    expect(
      rolesOf(card({}, "action", [{ roles: { add: ["tutor"] } }])),
    ).toEqual(["tutor"]);
  });
});

describe("fits", () => {
  it("nothing uses Runechants as a linked payoff: attacks spend them anyway (maintainer, 15 Oct 2026)", () => {
    for (const id of ["rune_gate", "runechant_discount", "arcane_payoff"]) {
      expect(ROLES.find((r) => r.id === id)).toMatchObject({
        engine: "runechant",
        kind: null,
      });
      expect(fits(["runechant_generator"], [id])).toBe(false);
    }
  });

  it("a generator fits a payoff of the same engine, either way round", () => {
    expect(fits(["gate_generator"], ["banish_play_payoff"])).toBe(true);
    expect(fits(["hand_banisher"], ["plays_from_banish"])).toBe(true);
    expect(fits(["sinchant"], ["aura_payoff"])).toBe(true);
    expect(fits(["eloquence"], ["tempo_payoff"])).toBe(true);
  });

  it("Gate generators feed Gate targets", () => {
    expect(fits(["gate_generator"], ["gate_target"])).toBe(true);
  });

  it("Runechant triggers are recorded but don't fit anything (maintainer, 15 Oct 2026)", () => {
    expect(fits(["runechant_trigger"], ["runechant_generator"])).toBe(false);
    expect(fits(["runechant_trigger"], ["rune_gate"])).toBe(false);
    expect(ROLES.find((r) => r.id === "runechant_trigger")).toMatchObject({
      engine: "runechant",
      kind: null,
    });
  });

  it("doesn't link across engines, two payoffs, or roles outside the engines", () => {
    expect(fits(["runechant_generator"], ["plays_from_banish"])).toBe(false);
    expect(fits(["rune_gate"], ["arcane_payoff"])).toBe(false);
    expect(fits(["runechant_generator"], ["runechant_burst"])).toBe(false);
    expect(fits(["usurp"], ["gate_target"])).toBe(false);
    expect(fits(["gate_target"], ["banish_play_payoff"])).toBe(false);
  });
});
