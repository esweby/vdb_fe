// Derived synergy rules (docs/synergy-rules.md). Each rule says "card A helps card B" and is
// directed. Rule sets and directions from the maintainer, 19 Oct 2026; default weights are
// UNVERIFIED starting points that admins tune (synergy_rule_weights).
import type { AuthoredCardAttributes, CardRef } from "./attributes.ts";
import { rolesOf, type Engine, type RoleCard, type RoleId } from "./roles.ts";

export interface SynergyCard extends RoleCard {
  id: string;
  name: string;
}

interface RuleBase {
  id: string;
  /** Shown in the UI, so users can see why an edge exists. */
  description: string;
  /** Default weight, 0–1. */
  weight: number;
  /** The engine the edge counts under in the ranking (the payoff's), or null. */
  engine: Engine | null;
  /** The edge leads to a traverse (README "Traverse" in docs/synergy-rules.md). */
  traverse?: boolean;
}

/** A role fit: any card with a `from` role helps any card with a `to` role. */
export interface RoleRule extends RuleBase {
  from: RoleId[];
  to: RoleId[];
}

/** A direct reference: an attribute on the card names the cards it helps. */
export interface ReferenceRule extends RuleBase {
  targets: (attributes: Partial<AuthoredCardAttributes>) => CardRef[];
}

export type SynergyRule = RoleRule | ReferenceRule;

const banishers: RoleId[] = ["hand_banisher", "deck_banisher", "self_banisher"];

export const SYNERGY_RULES: SynergyRule[] = [
  // Rule set 1: role fits, generator → payoff
  {
    id: "gate-feeds-gate-target",
    description: "Creates a Gate, which plays this blood debt card from banish",
    weight: 0.8,
    engine: "gate",
    traverse: true,
    from: ["gate_generator"],
    to: ["gate_target"],
  },
  {
    id: "gate-feeds-banish-play-payoff",
    description: "Creates a Gate, and this card is better played from banish",
    weight: 0.7,
    engine: "gate",
    from: ["gate_generator"],
    to: ["banish_play_payoff"],
  },
  {
    id: "banish-feeds-plays-from-banish",
    description: "Banishes cards, and this card can be played from banish",
    weight: 0.7,
    engine: "banish",
    from: ["hand_banisher", "deck_banisher"],
    to: ["plays_from_banish"],
  },
  // No "banishes itself, so this card can be played from banish": a card that banishes only
  // itself puts nothing else in the banished zone (the maintainer, 20 Oct 2026: Fallen Herald).
  {
    id: "banish-feeds-banish-play-payoff",
    description: "Fills the banished zone this card is better played from",
    weight: 0.6,
    engine: "banish",
    from: banishers,
    to: ["banish_play_payoff"],
  },
  {
    id: "hand-banish-feeds-banish-type",
    description:
      "Banishes a card you choose, and this card cares if it's Shadow or Runeblade",
    weight: 0.6,
    engine: "banish",
    from: ["hand_banisher"],
    to: ["banish_type_payoff"],
  },
  {
    id: "other-banish-feeds-banish-type",
    description:
      "Banishes a card, and this card cares if it's Shadow or Runeblade",
    weight: 0.3,
    engine: "banish",
    // Not a self-banisher: it doesn't banish this card (20 Oct 2026).
    from: ["deck_banisher"],
    to: ["banish_type_payoff"],
  },
  {
    id: "banish-fires-banish-trigger",
    description:
      "Banishes cards, which fires this card's 'when banished' effect",
    weight: 0.7,
    engine: "banish",
    // Not a self-banisher: banishing itself doesn't banish this card (20 Oct 2026).
    from: ["hand_banisher", "deck_banisher"],
    to: ["banish_trigger"],
  },
  {
    id: "aura-feeds-aura-payoff",
    description: "Makes auras, which this card counts",
    weight: 0.5,
    engine: "aura",
    from: ["aura_generator", "sinchant"],
    to: ["aura_payoff"],
  },
  {
    id: "tempo-feeds-tempo-payoff",
    description: "More actions in a turn, which this card needs",
    weight: 0.5,
    engine: "tempo",
    from: ["go_again_granter", "eloquence"],
    to: ["tempo_payoff"],
  },
  {
    id: "usurp-feeds-usurp-payoff",
    description: "Usurps, which this card rewards",
    weight: 0.8,
    engine: "usurp",
    from: ["usurp"],
    to: ["usurp_payoff"],
  },

  // Rule set 2: enabling links (maintainer, 19 Oct 2026)
  {
    id: "runechant-enables-rune-gate",
    description:
      "Makes Runechants, which let this Rune Gate card be played from banish",
    weight: 0.4,
    engine: "runechant",
    from: ["runechant_generator"],
    to: ["rune_gate"],
  },
  {
    id: "runechant-enables-usurp",
    description:
      "Makes a Runechant or is a sinchant, which this card needs to usurp",
    weight: 0.6,
    engine: "usurp",
    from: ["runechant_generator", "sinchant"],
    to: ["usurp"],
  },
  {
    id: "hand-banish-feeds-gate-target",
    description:
      "Banishes this blood debt card from hand, where a Gate can play it",
    weight: 0.6,
    engine: "gate",
    traverse: true,
    from: ["hand_banisher"],
    to: ["gate_target"],
  },
  {
    id: "deck-banish-feeds-gate-target",
    description: "Can banish this blood debt card, where a Gate can play it",
    weight: 0.3,
    engine: "gate",
    traverse: true,
    from: ["deck_banisher"],
    to: ["gate_target"],
  },

  // Rule set 3: direct references
  {
    id: "tutor-finds",
    description: "Searches your deck for this card",
    weight: 0.6,
    engine: null,
    targets: (a) => (a.tutors ?? []).map((t) => t.target),
  },
  {
    id: "enables-play-from-banish",
    description: "Lets this card be played from banish",
    weight: 0.8,
    engine: null,
    targets: (a) => (a.enablesPlayFromBanish ?? []).map((e) => e.target),
  },
  {
    id: "supports",
    description: "Works with this card (authored)",
    weight: 0.7,
    engine: null,
    targets: (a) => (a.supports ?? []).map((s) => s.target),
  },
];

export type SynergyRuleId = string;

export interface SynergyEdge {
  /** Card ids: `from` helps `to`. */
  from: string;
  to: string;
  /** The highest weight of the matching rules. */
  weight: number;
  /** The engine of the rule that set the weight. */
  engine: Engine | null;
  /** Every matching rule, highest weight first. */
  reasons: SynergyRuleId[];
  traverse: boolean;
}

const isRoleRule = (r: SynergyRule): r is RoleRule => "from" in r;

const refersTo = (ref: CardRef, card: SynergyCard) =>
  "group" in ref
    ? card.attributes.groups.includes(ref.group)
    : ref.card === card.name;

/**
 * Every derived edge between the cards. `weights` (admin-set, by rule id) replaces a rule's
 * default; a weight of 0 turns the rule off. Where several rules link the same pair, the edge
 * takes the highest weight, not the sum, and lists every reason.
 */
export function deriveSynergies(
  cards: SynergyCard[],
  weights: Record<SynergyRuleId, number> = {},
): SynergyEdge[] {
  const roles = new Map(cards.map((c) => [c.id, new Set(rolesOf(c))]));
  const has = (c: SynergyCard, ids: RoleId[]) =>
    ids.some((id) => roles.get(c.id)!.has(id));

  const matches = new Map<string, { rule: SynergyRule; weight: number }[]>();
  const add = (
    from: SynergyCard,
    to: SynergyCard,
    rule: SynergyRule,
    weight: number,
  ) => {
    if (from.id === to.id) return;
    const key = `${from.id}\u0000${to.id}`;
    matches.set(key, [...(matches.get(key) ?? []), { rule, weight }]);
  };

  for (const rule of SYNERGY_RULES) {
    const weight = weights[rule.id] ?? rule.weight;
    if (weight <= 0) continue;
    if (isRoleRule(rule)) {
      const to = cards.filter((c) => has(c, rule.to));
      for (const from of cards.filter((c) => has(c, rule.from)))
        for (const card of to) add(from, card, rule, weight);
    } else {
      for (const from of cards) {
        const refs = [
          from.attributes,
          ...(from.variantAttributes ?? []),
        ].flatMap(rule.targets);
        if (refs.length === 0) continue;
        for (const card of cards)
          if (refs.some((ref) => refersTo(ref, card)))
            add(from, card, rule, weight);
      }
    }
  }

  return [...matches.entries()].map(([key, all]) => {
    const [from, to] = key.split("\u0000") as [string, string];
    // A card that lets this one be played from banish already says why it helps: the banisher
    // rules would repeat it (the maintainer, 20 Oct 2026: Rattle Bones and Usurp the Shadow
    // Throne).
    const enables = all.some((m) => m.rule.id === "enables-play-from-banish");
    const found = enables
      ? all.filter(
          (m) =>
            !isRoleRule(m.rule) ||
            !m.rule.from.some((r) => banishers.includes(r)),
        )
      : all;
    const sorted = [...found].sort((a, b) => b.weight - a.weight);
    const top = sorted[0]!;
    return {
      from,
      to,
      weight: top.weight,
      engine: top.rule.engine,
      reasons: [...new Set(sorted.map((m) => m.rule.id))],
      traverse: found.some((m) => !!m.rule.traverse),
    };
  });
}
