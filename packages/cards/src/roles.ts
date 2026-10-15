// Roles and engines, first pass (docs/roles.md). UNVERIFIED unless a rule says it was checked.
// An engine is a plan Viserai can run. Its generators make the resource, and its payoffs use
// it or get better because of it. Roles are read from the
// card attributes, so new cards get them automatically; `roles` in a card's authored
// attributes corrects them by hand.
import type { AuthoredCardAttributes, CardAttributes } from "./attributes.ts";
import type { CardGroup } from "./groups.ts";

export type Engine = "runechant" | "gate" | "banish" | "aura" | "tempo";

/** Every role, in the order a card's roles are listed. */
export const ROLE_IDS = [
  "runechant_generator",
  "runechant_burst",
  "runechant_granter",
  "rune_gate",
  "runechant_discount",
  "arcane_payoff",
  "runechant_trigger",
  "gate_generator",
  "gate_target",
  "banish_play_payoff",
  "hand_banisher",
  "deck_banisher",
  "self_banisher",
  "plays_from_banish",
  "banish_type_payoff",
  "banish_trigger",
  "aura_generator",
  "sinchant",
  "aura_payoff",
  "go_again_granter",
  "eloquence",
  "tempo_payoff",
  "usurp",
  "disruption",
  "tutor",
] as const;
export type RoleId = (typeof ROLE_IDS)[number];
export type RoleKind = "generator" | "payoff";

export interface RoleCard {
  type: string;
  subtypes?: string[];
  attributes: CardAttributes;
  /** Each pitch's own attributes (they can differ, e.g. how many Runechants). */
  variantAttributes?: Partial<AuthoredCardAttributes>[];
}

export interface RoleDef {
  id: RoleId;
  name: string;
  /** null: a role outside the engines. */
  engine: Engine | null;
  /** null: recorded (and countable) but not linked to anything. */
  kind: RoleKind | null;
  matches: (card: RoleCard) => boolean;
}

type Attrs = Partial<AuthoredCardAttributes>;
/** The card's attributes and every pitch's, since a role can come from either. */
const each = (c: RoleCard): Attrs[] => [
  c.attributes,
  ...(c.variantAttributes ?? []),
];
const any = (c: RoleCard, test: (a: Attrs) => unknown) =>
  each(c).some((a) => !!test(a));
const inGroup = (c: RoleCard, group: CardGroup) =>
  c.attributes.groups.includes(group);
const mentions = (c: RoleCard, conditions: string[]) =>
  any(c, (a) => conditions.some((x) => JSON.stringify(a).includes(`"${x}"`)));

const runechantsMade = (c: RoleCard) =>
  each(c).flatMap((a) =>
    (a.tokens ?? []).filter((t) => t.token === "runechant" && !t.grantedTo),
  );

export const ROLES: RoleDef[] = [
  // Runechant engine (Forsaken: create 3 in a turn to traverse)
  {
    id: "runechant_generator",
    name: "Runechant generator",
    engine: "runechant",
    kind: "generator",
    matches: (c) => runechantsMade(c).length > 0,
  },
  {
    id: "runechant_burst",
    name: "Runechant burst",
    engine: "runechant",
    kind: "generator",
    matches: (c) =>
      runechantsMade(c).some(
        (t) =>
          t.amount === "X" || (typeof t.amount === "number" && t.amount >= 3),
      ),
  },
  {
    id: "runechant_granter",
    name: "Runechant granter",
    engine: "runechant",
    kind: "generator",
    matches: (c) =>
      any(c, (a) =>
        a.tokens?.some((t) => t.token === "runechant" && !!t.grantedTo),
      ),
  },
  {
    id: "rune_gate",
    name: "Rune Gate",
    engine: "runechant",
    kind: "payoff",
    matches: (c) => c.attributes.hasRuneGate,
  },
  {
    id: "runechant_discount",
    name: "Runechant discount",
    engine: "runechant",
    kind: "payoff",
    matches: (c) =>
      any(
        c,
        (a) =>
          a.costReducedPerRunechant ||
          a.costReductions?.some((r) => r.amount === "per_runechant"),
      ),
  },
  {
    id: "arcane_payoff",
    name: "Arcane payoff",
    engine: "runechant",
    kind: "payoff",
    matches: (c) =>
      mentions(c, [
        "dealt_arcane_damage_this_turn",
        "dealt_arcane_damage_to_opponent_this_turn",
        "created_3_or_more_runechants",
      ]),
  },
  {
    id: "runechant_trigger",
    name: "Runechant trigger",
    engine: "runechant",
    // Attack action cards and weapon attacks fire Runechants, but that's most of the deck, so
    // it isn't linked: "slightly irrelevant" (maintainer, 15 Oct 2026).
    kind: null,
    matches: (c) =>
      c.type === "attack_action" ||
      (c.type === "weapon" && c.attributes.canAttack),
  },

  // Gate engine (Usurper: create or use a Gate to traverse)
  {
    id: "gate_generator",
    name: "Gate generator",
    engine: "gate",
    kind: "generator",
    matches: (c) => any(c, (a) => a.tokens?.some((t) => t.token === "gate")),
  },
  {
    id: "gate_target",
    name: "Gate target",
    engine: "gate",
    // Maintainer, 15 Oct 2026: the Gate's payoff. A Gate plays a blood debt card out of
    // banish, so it isn't stuck there, and creating or using a Gate lets Usurper traverse.
    kind: "payoff",
    matches: (c) => c.attributes.isGateTarget,
  },
  {
    id: "banish_play_payoff",
    name: "Banish-play payoff",
    engine: "gate",
    kind: "payoff",
    matches: (c) =>
      any(c, (a) => a.rewardsPlayFromBanish) ||
      mentions(c, ["played_from_banish"]),
  },

  // Banish engine (both sides fill the banished zone)
  {
    id: "hand_banisher",
    name: "Hand banisher",
    engine: "banish",
    kind: "generator",
    matches: (c) => inGroup(c, "banishes_from_hand"),
  },
  {
    id: "deck_banisher",
    name: "Deck or graveyard banisher",
    engine: "banish",
    kind: "generator",
    matches: (c) =>
      any(c, (a) => a.banishesOwn?.some((b) => b.from !== "hand")),
  },
  {
    id: "self_banisher",
    name: "Self-banisher",
    engine: "banish",
    kind: "generator",
    matches: (c) => any(c, (a) => (a.banishesSelf?.length ?? 0) > 0),
  },
  {
    id: "plays_from_banish",
    name: "Plays from banish",
    engine: "banish",
    kind: "payoff",
    matches: (c) => any(c, (a) => a.playableFromBanish),
  },
  {
    id: "banish_type_payoff",
    name: "Banish-type payoff",
    engine: "banish",
    kind: "payoff",
    matches: (c) =>
      inGroup(c, "rewards_shadow_banish") ||
      inGroup(c, "rewards_runeblade_banish"),
  },
  {
    id: "banish_trigger",
    name: "Banish trigger",
    engine: "banish",
    kind: "payoff",
    matches: (c) => inGroup(c, "triggers_when_banished"),
  },

  // Aura engine: Runechants, Gates and Eloquence are all aura tokens (README "Tokens")
  {
    id: "aura_generator",
    name: "Aura generator",
    engine: "aura",
    kind: "generator",
    matches: (c) =>
      !!c.subtypes?.includes("Aura") ||
      any(c, (a) => (a.tokens?.length ?? 0) > 0),
  },
  {
    id: "sinchant",
    name: "Sinchant",
    engine: "aura",
    kind: "generator",
    matches: (c) => inGroup(c, "runechant_aura"),
  },
  {
    id: "aura_payoff",
    name: "Aura payoff",
    engine: "aura",
    kind: "payoff",
    matches: (c) =>
      mentions(c, [
        "played_or_created_aura_this_turn",
        "played_or_created_2_or_more_auras_this_turn",
        "played_or_created_3_or_more_auras_this_turn",
        "destroyed_own_aura",
      ]),
  },

  // Tempo engine: more action cards in a turn
  {
    id: "go_again_granter",
    name: "Go again granter",
    engine: "tempo",
    kind: "generator",
    matches: (c) => any(c, (a) => a.grantsGoAgain),
  },
  {
    id: "eloquence",
    name: "Eloquence",
    engine: "tempo",
    kind: "generator",
    matches: (c) =>
      any(c, (a) => a.tokens?.some((t) => t.token === "eloquence")),
  },
  {
    id: "tempo_payoff",
    name: "Tempo payoff",
    engine: "tempo",
    kind: "payoff",
    matches: (c) =>
      mentions(c, [
        "played_attack_action_this_turn",
        "played_non_attack_action_this_turn",
      ]),
  },

  // Outside the engines: recorded, not linked
  {
    id: "usurp",
    name: "Usurp",
    engine: null,
    kind: null,
    matches: (c) => c.attributes.hasUsurp,
  },
  {
    id: "disruption",
    name: "Disruption",
    engine: null,
    kind: null,
    matches: (c) => any(c, (a) => (a.disrupts?.length ?? 0) > 0),
  },
  {
    id: "tutor",
    name: "Tutor",
    engine: null,
    kind: null,
    matches: (c) => any(c, (a) => (a.tutors?.length ?? 0) > 0),
  },
];

const byId = new Map<string, RoleDef>(ROLES.map((r) => [r.id, r]));

/** The roles a card has, after any corrections by hand, in the order of ROLE_IDS. */
export function rolesOf(card: RoleCard): RoleId[] {
  const roles = new Set(ROLES.filter((r) => r.matches(card)).map((r) => r.id));
  for (const a of each(card)) {
    for (const id of a.roles?.remove ?? []) roles.delete(id);
    for (const id of a.roles?.add ?? []) roles.add(id);
  }
  return ROLE_IDS.filter((id) => roles.has(id));
}

/** Two cards fit when one has a generator role and the other a payoff role in the same engine. */
export function fits(a: string[], b: string[]): boolean {
  const roles = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((r): r is RoleDef => !!r?.engine);
  const ra = roles(a);
  const rb = roles(b);
  return ra.some((x) =>
    rb.some(
      (y) =>
        x.engine === y.engine &&
        ((x.kind === "generator" && y.kind === "payoff") ||
          (x.kind === "payoff" && y.kind === "generator")),
    ),
  );
}
