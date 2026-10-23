// Condition availability in the deck's card list (README "Deck builder"): each card's
// availability from its condition scenarios (conditionAvailability.ts), and the deck sorted or
// filtered by it.
import type { OneOutput } from "../ranking/scenarioRuns.ts";
import type { AvailabilityScenario } from "./conditionAvailability.ts";
import type { DeckEntry } from "./deckRules.ts";

/**
 * Below this, a card's condition is "rarely available": in hand with what it needs less than
 * one opening hand in four.
 *
 * UNVERIFIED: a first pass for the maintainer or an experienced player to check.
 */
export const RARELY_BELOW = 0.25;

export interface CardAvailability {
  /** The lowest of its conditions: the one that holds it back. */
  rate: number;
  conditions: { plain: string; needs: string; rate: number }[];
}

/** Each card's availability, by card id. A condition that couldn't run is left out. */
export function availabilityByCard(
  scenarios: Pick<AvailabilityScenario, "cardId" | "plain" | "needs">[],
  outputs: OneOutput[],
): Map<string, CardAvailability> {
  const byCard = new Map<string, CardAvailability>();
  scenarios.forEach((s, i) => {
    const result = outputs[i]?.result;
    if (!result) return;
    const condition = {
      plain: s.plain,
      needs: s.needs,
      rate: result.successRate,
    };
    const card = byCard.get(s.cardId);
    if (card) {
      card.conditions.push(condition);
      card.rate = Math.min(card.rate, condition.rate);
    } else
      byCard.set(s.cardId, { rate: condition.rate, conditions: [condition] });
  });
  return byCard;
}

/** The least available first, then the cards with nothing measured, by name. */
export function sortByAvailability(
  entries: DeckEntry[],
  byCard: Map<string, CardAvailability>,
): DeckEntry[] {
  const rate = (e: DeckEntry) => byCard.get(e.card.id)?.rate ?? Infinity;
  return [...entries].sort(
    (a, b) =>
      rate(a) - rate(b) ||
      a.card.name.localeCompare(b.card.name) ||
      (a.variant.pitch ?? 99) - (b.variant.pitch ?? 99),
  );
}

/** The cards whose condition is rarely available. */
export function rarelyAvailable(
  entries: DeckEntry[],
  byCard: Map<string, CardAvailability>,
): DeckEntry[] {
  return entries.filter(
    (e) => (byCard.get(e.card.id)?.rate ?? Infinity) < RARELY_BELOW,
  );
}
