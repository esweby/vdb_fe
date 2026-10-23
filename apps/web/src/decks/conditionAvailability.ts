// Condition availability (README "Deck analysis", phase two step 7): each condition a deck's
// cards record becomes a built-in scenario. With the card in the opening hand, is what the
// condition needs in that hand too? It's how often the condition is available, not expected
// output: having a Shadow card in hand doesn't mean you'll play the line that banishes it.
//
// UNVERIFIED: which conditions a hand can show, and what each needs, are a first pass for the
// maintainer or an experienced player to check (README "Condition definitions").
import { conditionsOf, type Condition } from "@vdb/cards";
import type { ScenarioDefinition } from "@vdb/engine";
import { engineCardOf } from "../ranking/scenarios.ts";
import { sectionOf, type DeckEntry } from "./deckRules.ts";

/** Each condition in plain words (docs/attribute-vocabulary.md). */
export const CONDITION_PLAIN: Record<Condition, string> = {
  banished_card_is_runeblade: "the banished card is Runeblade",
  banished_card_is_shadow: "the banished card is Shadow",
  pitched_attack_action: "an attack action card was pitched to play it",
  pitched_non_attack_action: "a non-attack action card was pitched to play it",
  played_attack_action_this_turn:
    "you've played an attack action card this turn",
  played_non_attack_action_this_turn:
    "you've played a non-attack action card this turn",
  dealt_arcane_damage_this_turn: "you've dealt arcane damage this turn",
  played_or_created_aura_this_turn:
    "you've played or created an aura this turn",
  played_or_created_2_or_more_auras_this_turn:
    "you've played or created 2 or more auras this turn",
  played_or_created_3_or_more_auras_this_turn:
    "you've played or created 3 or more auras this turn",
  played_from_banish: "it was played from your banished zone",
  top_card_matches_pitch: "the banished or revealed card matches its colour",
  destroyed_own_aura: "you destroyed an aura you control",
  hero_lost_life_this_turn: "a hero has lost life this turn",
  dealt_damage_to_defending_hero_this_turn:
    "you've dealt damage to the defending hero this turn",
  dealt_arcane_damage_to_opponent_this_turn:
    "you've dealt arcane damage to an opponent this turn",
  created_3_or_more_runechants: "it created 3 or more Runechants",
  paid_optional_additional_cost: "you paid its optional additional cost",
  defending_hero_has_soul_cards: "the defending hero has cards in their soul",
  usurped_this_turn: "you've usurped this turn",
  played_card_from_banish_this_turn:
    "you've played a card from your banished zone this turn",
  it_defended: "it defended",
  banished_a_card: "you banished a card this way",
  discarded_attack_action: "you discarded an attack action card",
  discarded_non_attack_action: "you discarded a non-attack action card",
  x_is_2_or_more: "X is 2 or more",
};

type Filter = { type?: string; trait?: string; role?: string };
interface Need {
  /** "another Shadow card in hand to banish" */
  needs: string;
  /** Any one of these is enough. */
  anyOf: { filter: Filter; what: string }[];
}

const another = (what: string, why: string, filter: Filter): Need => ({
  needs: `another ${what} card in hand ${why}`,
  anyOf: [{ filter, what }],
});

/** What a condition needs in hand alongside the card, or null when a hand can't show it. */
function needOf(condition: Condition, banishesFromHand: boolean): Need | null {
  switch (condition) {
    case "banished_card_is_runeblade":
      return banishesFromHand
        ? another("Runeblade", "to banish", { trait: "runeblade" })
        : null;
    case "banished_card_is_shadow":
      return banishesFromHand
        ? another("Shadow", "to banish", { trait: "shadow" })
        : null;
    case "pitched_attack_action":
      return another("attack action", "to pitch", { type: "attack_action" });
    case "pitched_non_attack_action":
      return another("non-attack action", "to pitch", { type: "action" });
    case "played_attack_action_this_turn":
      return another("attack action", "to play first", {
        type: "attack_action",
      });
    case "played_non_attack_action_this_turn":
      return another("non-attack action", "to play first", { type: "action" });
    case "discarded_attack_action":
      return another("attack action", "to discard", { type: "attack_action" });
    case "discarded_non_attack_action":
      return another("non-attack action", "to discard", { type: "action" });
    case "played_or_created_aura_this_turn":
      // Runechants are auras, so a card that makes them counts.
      return {
        needs: "another card in hand that is an aura or makes Runechants",
        anyOf: [
          { filter: { trait: "aura" }, what: "aura" },
          { filter: { role: "runechant_generator" }, what: "Runechant maker" },
        ],
      };
    default:
      return null;
  }
}

export interface AvailabilityScenario {
  cardId: string;
  cardName: string;
  condition: Condition;
  plain: string;
  needs: string;
  definition: ScenarioDefinition;
}

/** The scenarios for a deck's conditions, and the conditions a hand can't show. */
export function availabilityScenarios(entries: DeckEntry[]): {
  scenarios: AvailabilityScenario[];
  notMeasured: { cardName: string; plain: string }[];
} {
  const scenarios: AvailabilityScenario[] = [];
  const notMeasured: { cardName: string; plain: string }[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    if (e.sideboard || sectionOf(e.card) !== "deck" || seen.has(e.card.id))
      continue;
    seen.add(e.card.id);
    const self = engineCardOf(e.card, e.variant);
    const fromHand = (e.card.attributes.banishesOwn ?? []).some(
      (b) => b.from === "hand",
    );
    const matches = (f: Filter) =>
      (f.type === undefined || self.type === f.type) &&
      (f.trait === undefined || self.traits.includes(f.trait)) &&
      (f.role === undefined || self.roles.includes(f.role));
    for (const condition of conditionsOf(
      e.card.attributes,
      e.card.variants.map((v) => v.attributes),
    )) {
      const plain = CONDITION_PLAIN[condition];
      const need = needOf(condition, fromHand);
      if (!need) {
        notMeasured.push({ cardName: e.card.name, plain });
        continue;
      }
      scenarios.push({
        cardId: e.card.id,
        cardName: e.card.name,
        condition,
        plain,
        needs: need.needs,
        definition: {
          version: 1,
          name: `${e.card.name}: ${plain}`,
          horizon: 0,
          turnModel: "fresh",
          access: ["hand"],
          fixed: [{ name: e.card.name, zone: "hand" }],
          condition: {
            any: need.anyOf.map(({ filter }) => ({
              label: need.needs,
              filter,
              // The card itself is in hand: if it matches, it takes a second.
              min: matches(filter) ? 2 : 1,
            })),
          },
        },
      });
    }
  }
  return { scenarios, notMeasured };
}
