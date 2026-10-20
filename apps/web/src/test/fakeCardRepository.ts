import type { CardAttributes } from "@vdb/cards";
import type { CardRepository, CardSummary } from "../cards/cardRepository.ts";

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

const v = (id: string, pitch: number | null, power: number | null = null) => ({
  id,
  pitch,
  cost: pitch === null ? null : 0,
  power,
  defense: pitch === null ? null : 3,
  attributes: {},
});

export const sampleCards: CardSummary[] = [
  {
    id: "card-hocus-pocus",
    name: "Hocus Pocus",
    type: "attack_action",
    subtypes: ["Attack"],
    classes: ["Runeblade"],
    talents: [],
    keywords: ["Blood Debt"],
    attributes: {
      ...generated,
      hasBloodDebt: true,
      isGateTarget: true,
      groups: ["runeblade_attack_action"],
    },
    attributesVerified: true,
    variants: [1, 2, 3].map((p) => ({
      ...v(`hp${p}`, p, 5 - p),
      attributes: {
        tokens: [
          {
            token: "runechant" as const,
            amount: 1,
            trigger: "on_attack" as const,
          },
        ],
      },
    })),
  },
  {
    id: "card-become-the-shadow-lord",
    name: "Become the Shadow Lord",
    type: "action",
    subtypes: [],
    classes: ["Runeblade"],
    talents: ["Shadow"],
    keywords: ["Go again"],
    attributes: {
      ...generated,
      hasGoAgain: true,
      groups: [
        "runeblade_non_attack_action",
        "banishes_from_hand",
        "rewards_shadow_banish",
      ],
      banishesOwn: [{ from: "hand", trigger: "on_play" }],
      tokens: [
        {
          token: "runechant",
          amount: 1,
          trigger: "on_play",
          conditions: ["banished_card_is_runeblade"],
        },
        {
          token: "gate",
          amount: 1,
          trigger: "on_play",
          conditions: ["banished_card_is_shadow"],
        },
      ],
    },
    attributesVerified: true,
    variants: [v("bsl3", 3)],
  },
  {
    id: "card-fate-foreseen",
    name: "Fate Foreseen",
    type: "defense_reaction",
    subtypes: [],
    classes: ["Generic"],
    talents: [],
    keywords: [],
    attributes: generated,
    attributesVerified: false,
    variants: [v("ff1", 1), v("ff2", 2), v("ff3", 3)],
  },
  {
    id: "card-nebula-blade",
    name: "Nebula Blade",
    type: "weapon",
    subtypes: ["Sword", "2H"],
    classes: ["Runeblade"],
    talents: [],
    keywords: [],
    attributes: { ...generated, canAttack: true },
    attributesVerified: true,
    variants: [v("nb", null, 1)],
  },
];

/**
 * Hocus Pocus under another name, so it has no verified rules: for tests that need an unverified
 * card now Hocus Pocus itself is verified (the maintainer's first accepted batch, 20 Oct 2026).
 */
export const TEST_POCUS: CardSummary = {
  ...sampleCards[0]!,
  id: "card-test-pocus",
  name: "Test Pocus",
  variants: sampleCards[0]!.variants.map((v) => ({
    ...v,
    id: v.id.replace("hp", "tp"),
  })),
};

export function fakeCardRepository(
  cards: CardSummary[] = sampleCards,
): CardRepository {
  return { listCards: async () => cards };
}
