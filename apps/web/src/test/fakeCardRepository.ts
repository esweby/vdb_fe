import type { CardRepository, CardSummary } from "../cards/cardRepository.ts";

const v = (id: string, pitch: number | null, power: number | null = null) => ({
  id,
  pitch,
  cost: pitch === null ? null : 0,
  power,
  defense: pitch === null ? null : 3,
});

export const sampleCards: CardSummary[] = [
  {
    id: "card-hocus-pocus",
    name: "Hocus Pocus",
    type: "attack_action",
    subtypes: ["Attack"],
    classes: ["Runeblade"],
    talents: [],
    variants: [v("hp1", 1, 4), v("hp2", 2, 3), v("hp3", 3, 2)],
  },
  {
    id: "card-become-the-shadow-lord",
    name: "Become the Shadow Lord",
    type: "action",
    subtypes: [],
    classes: ["Runeblade"],
    talents: ["Shadow"],
    variants: [v("bsl3", 3)],
  },
  {
    id: "card-fate-foreseen",
    name: "Fate Foreseen",
    type: "defense_reaction",
    subtypes: [],
    classes: ["Generic"],
    talents: [],
    variants: [v("ff1", 1), v("ff2", 2), v("ff3", 3)],
  },
  {
    id: "card-nebula-blade",
    name: "Nebula Blade",
    type: "weapon",
    subtypes: ["Sword", "2H"],
    classes: ["Runeblade"],
    talents: [],
    variants: [v("nb", null, 1)],
  },
];

export function fakeCardRepository(
  cards: CardSummary[] = sampleCards,
): CardRepository {
  return { listCards: async () => cards };
}
