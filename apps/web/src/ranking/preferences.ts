// Preferences: the user's own leaning towards a style of card, as sliders from Avoid to
// Prefer. They change the board's order and what Fill to targets picks, never a card's score.
// The groups follow the maintainer (15 Oct 2026); the sizes are UNVERIFIED tuning.
import type { RoleId } from "@vdb/cards";

export interface Preference {
  id: string;
  label: string;
  /** Shown under the slider. */
  note: string;
  members: (roles: RoleId[]) => boolean;
  /** Cards that come along with the members, floated half as far. */
  companions: (roles: RoleId[]) => boolean;
}

const has = (roles: RoleId[], ...ids: RoleId[]) =>
  ids.some((id) => roles.includes(id));

export const PREFERENCES: Preference[] = [
  {
    id: "runeGate",
    label: "Rune Gate cards",
    note: "Brings Runechant makers and sinchants with them.",
    members: (r) => has(r, "rune_gate"),
    companions: (r) => has(r, "runechant_generator", "sinchant"),
  },
  {
    id: "usurp",
    label: "Usurp cards",
    note: "Brings cards that reward usurping with them.",
    members: (r) => has(r, "usurp"),
    companions: (r) => has(r, "usurp_payoff"),
  },
  {
    id: "gateTargets",
    label: "Gate targets",
    note: "Blood debt cards that aren't Rune Gate or Usurp. Brings Gate makers.",
    members: (r) => has(r, "gate_target") && !has(r, "rune_gate", "usurp"),
    companions: (r) => has(r, "gate_generator"),
  },
  {
    id: "everyTurn",
    label: "Runechants every turn",
    note: "Auras and the like that make Runechants turn after turn, e.g. Malefic Incantation.",
    members: (r) => has(r, "runechant_every_turn"),
    companions: () => false,
  },
  {
    id: "disruption",
    label: "Disruption",
    note: "Cards that banish, discard or destroy the opponent's cards.",
    members: (r) => has(r, "disruption"),
    companions: () => false,
  },
];

/** How far a fully preferred card moves up the board (UNVERIFIED). */
export const MAX_BOOST = 25;

/**
 * The sum, over preferences, of how far this card moves: up to ±25 for a member and half
 * that for a companion. 50 on a slider is neutral.
 */
export function preferenceBoost(
  roles: RoleId[],
  prefs: Record<string, number>,
): number {
  let boost = 0;
  for (const p of PREFERENCES) {
    const lean = ((prefs[p.id] ?? 50) - 50) / 50;
    if (lean === 0) continue;
    if (p.members(roles)) boost += lean * MAX_BOOST;
    else if (p.companions(roles)) boost += (lean * MAX_BOOST) / 2;
  }
  return boost;
}
