// A deck list as the rules engine plays it (docs/engine-calibration.md): the app's own card
// mapping, weapons and equipment in their slots, and the main deck's coverage by verified rules,
// by distinct card and by copy. Unverified cards can be pitched or held, never played.
import type { RulesCard } from "@esweby/fab-engine/rules";
import type { CardSummary } from "../cards/cardRepository.ts";
import { PITCH_NAMES } from "../decks/deckRules.ts";
import { rulesCardOf } from "../scenarios/rulesCards.ts";
import type { DeckListEntry } from "./deckList.ts";

const label = (name: string, pitch: number | null) =>
  pitch === null ? name : `${name} (${PITCH_NAMES[pitch] ?? pitch})`;

export function resolveDeck(entries: DeckListEntry[], cards: CardSummary[]) {
  const byName = new Map(cards.map((c) => [c.name.toLowerCase(), c]));
  const deck: RulesCard[] = [];
  const weapons: RulesCard[] = [];
  const equipment: RulesCard[] = [];
  const missing: string[] = [];
  const distinct = new Map<string, boolean>();
  for (const e of entries) {
    const card = byName.get(e.name.toLowerCase());
    const variant = card?.variants.find((v) => v.pitch === e.pitch);
    if (!card || !variant) {
      missing.push(label(e.name, e.pitch));
      continue;
    }
    const rules = rulesCardOf(card, variant);
    const slot =
      card.type === "weapon"
        ? weapons
        : card.type === "equipment"
          ? equipment
          : deck;
    for (let i = 0; i < e.copies; i++) slot.push(rules);
    if (slot === deck)
      distinct.set(
        label(card.name, variant.pitch),
        rules.effects !== undefined,
      );
  }
  const modelledCopies = deck.filter((c) => c.effects !== undefined).length;
  return {
    deck,
    weapons,
    equipment,
    missing,
    coverage: {
      copies: { modelled: modelledCopies, total: deck.length },
      distinct: {
        modelled: [...distinct.values()].filter(Boolean).length,
        total: distinct.size,
      },
      unmodelled: [...distinct].filter(([, m]) => !m).map(([n]) => n),
    },
  };
}
