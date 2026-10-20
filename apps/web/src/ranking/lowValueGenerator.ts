// Low-value Runechant generators (the maintainer, 20 Oct 2026): a generator in a core should make
// 3, or make them over a number of turns. Blue Runeblood Incantation makes one and is done either
// way, so the core builder discourages it. Applied to the "Runechants every turn" cards only;
// whether one-off makers like yellow Read the Runes count too is UNVERIFIED and left out.
import type { AuthoredCardAttributes } from "@vdb/cards";
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";

/** Made one a turn, from verse counters: as many turns as Runechants. */
const ONE_A_TURN = new Set([
  "start_of_action_phase",
  "your_attack_action_played",
]);
/** Made all at once, a turn later. */
const ALL_AT_ONCE = new Set(["start_of_turn"]);

/** How far a low-value pitch moves down in the core builder (UNVERIFIED tuning). */
export const GENERATOR_PENALTY = 25;

/** Whether this pitch of a card makes fewer than 3 Runechants, all in a single turn. */
export function lowValueGenerator(
  card: CardSummary,
  variant: VariantSummary,
): boolean {
  if (card.type === "attack_action") return false;
  const a = {
    ...card.attributes,
    ...variant.attributes,
  } as Partial<AuthoredCardAttributes>;
  const made = (a.tokens ?? []).filter(
    (t) =>
      t.token === "runechant" &&
      !t.grantedTo &&
      typeof t.amount === "number" &&
      (ONE_A_TURN.has(t.trigger) || ALL_AT_ONCE.has(t.trigger)),
  );
  if (made.length === 0) return false;
  const total = made.reduce((n, t) => n + (t.amount as number), 0);
  const turns = Math.max(
    ...made.map((t) => (ONE_A_TURN.has(t.trigger) ? (t.amount as number) : 1)),
  );
  return total < 3 && turns < 2;
}

/** A candidate's place in the core builder, moved down when it's a low-value generator. */
export function withGeneratorPenalty(key: number, low: boolean): number {
  return low ? key - GENERATOR_PENALTY : key;
}
