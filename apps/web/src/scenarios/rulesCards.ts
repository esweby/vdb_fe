// The app's cards as the rules engine sees them (docs/rules-engine.md, step 7b): the counting
// engine's card, plus the variant's cost and printed power, natural go again, and the card's verified rules by name.
// A card with no verified rules stays unmodelled: the engine can pitch or hold it, not play it.
import { cardWithRules, type RulesCard } from "@esweby/fab-engine/rules";
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";
import { engineCardOf } from "../ranking/scenarios.ts";

export function rulesCardOf(
  card: CardSummary,
  variant: VariantSummary,
): RulesCard {
  return cardWithRules({
    ...engineCardOf(card, variant),
    cost: variant.cost,
    power: variant.power,
    goAgain: card.attributes.hasGoAgain,
  });
}
