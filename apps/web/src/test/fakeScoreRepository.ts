import type {
  CardDetail,
  Dimension,
  ScoreKey,
  ScoreRepository,
  ScoreRow,
} from "../scoring/scoreRepository.ts";

export const sampleDimensions: Dimension[] = [
  { id: 1, key: "runechantCreation", label: "Runechant creation" },
  { id: 2, key: "gateCreation", label: "Gate creation" },
];

export const sampleDetail: CardDetail = {
  id: "card-become-the-shadow-lord",
  name: "Become the Shadow Lord",
  type: "action",
  classes: ["Runeblade"],
  talents: ["Shadow"],
  text: "Banish a card from your hand. If it's Runeblade, create a Runechant token.",
  attributes: {
    hasGoAgain: true,
    hasBloodDebt: false,
    hasUsurp: false,
    hasRuneGate: false,
    isGateTarget: false,
    canAttack: false,
    groups: [],
    specialization: null,
    tokens: [
      {
        token: "runechant",
        amount: 1,
        trigger: "on_play",
        conditions: ["banished_card_is_runeblade"],
      },
    ],
  },
  attributesVerified: true,
  variants: [{ id: "bsl3", pitch: 3, text: null }],
};

/** An in-memory ScoreRepository; `saved` records every write. */
export function fakeScoreRepository(initial: ScoreRow[] = []) {
  let rows = [...initial];
  const saved: string[] = [];
  const same = (a: ScoreKey, b: ScoreKey) =>
    a.variantId === b.variantId &&
    a.side === b.side &&
    a.dimensionId === b.dimensionId;
  const repository: ScoreRepository = {
    getCard: async (id) => (id === sampleDetail.id ? sampleDetail : null),
    listDimensions: async () => sampleDimensions,
    listMyScores: async () => rows,
    async saveScore(_cardId, key, score) {
      saved.push(
        `save ${key.dimensionId}:${key.variantId ?? "card"}:${key.side ?? "both"}=${score}`,
      );
      rows = [...rows.filter((r) => !same(r, key)), { ...key, score }];
    },
    async clearScore(_cardId, key) {
      saved.push(
        `clear ${key.dimensionId}:${key.variantId ?? "card"}:${key.side ?? "both"}`,
      );
      rows = rows.filter((r) => !same(r, key));
    },
  };
  return { repository, saved };
}
