import type {
  Deck,
  DeckRepository,
  Hero,
  Matchup,
} from "../decks/deckRepository.ts";
import type { FormatRules } from "../decks/deckRules.ts";

export const sampleRules: FormatRules = {
  copyLimit: 3,
  deckMin: 60,
  poolMax: 80,
  weaponHands: 2,
};

/** A deck for tests: private and owned by u1 unless it says otherwise. */
export type DeckFixture = Omit<Deck, "isPublic" | "ownerId"> &
  Partial<Pick<Deck, "isPublic" | "ownerId">>;

/** An in-memory DeckRepository; `saved` records every write. New decks belong to `userId`. */
export function fakeDeckRepository(
  initial: DeckFixture[] = [],
  options: { userId?: string; heroes?: Hero[]; matchups?: Matchup[] } = {},
) {
  let matchups = [...(options.matchups ?? [])];
  let nextMatchup = 0;
  let decks: Deck[] = initial.map((d) => ({
    isPublic: false,
    ownerId: "u1",
    ...d,
    cards: [...d.cards],
  }));
  const summary = ({ pitchTargets: _, ...d }: Deck) => d;
  const saved: string[] = [];
  const repository: DeckRepository = {
    listMyDecks: async (userId) =>
      decks.filter((d) => d.ownerId === userId).map(summary),
    listPublicDecks: async () => decks.filter((d) => d.isPublic).map(summary),
    async createDeck(name, createOptions) {
      const isPublic = createOptions?.isPublic ?? false;
      saved.push(`create ${name}${isPublic ? " public" : ""}`);
      const deck: Deck = {
        id: `deck-${decks.length + 1}`,
        name,
        updatedAt: "2026-10-14T12:00:00Z",
        isPublic,
        ownerId: options.userId ?? "u1",
        cards: [],
        pitchTargets: {},
      };
      decks = [...decks, deck];
      return summary(deck);
    },
    async setVisibility(deckId, isPublic) {
      saved.push(`${isPublic ? "public" : "private"} ${deckId}`);
      decks = decks.map((d) => (d.id === deckId ? { ...d, isPublic } : d));
    },
    async renameDeck(deckId, name) {
      saved.push(`rename ${deckId} ${name}`);
      decks = decks.map((d) => (d.id === deckId ? { ...d, name } : d));
    },
    async deleteDeck(deckId) {
      saved.push(`delete ${deckId}`);
      decks = decks.filter((d) => d.id !== deckId);
    },
    getDeck: async (id) => decks.find((d) => d.id === id) ?? null,
    async setCard(deckId, card) {
      saved.push(
        `set ${deckId} ${card.variantId} ${card.quantity} ${card.sideboard ? "side" : "main"}`,
      );
      decks = decks.map((d) =>
        d.id !== deckId
          ? d
          : {
              ...d,
              cards: [
                ...d.cards.filter((c) => c.variantId !== card.variantId),
                ...(card.quantity > 0 ? [card] : []),
              ],
            },
      );
    },
    async setPitchTargets(deckId, targets) {
      saved.push(
        `targets ${deckId} ${Object.entries(targets)
          .map(([p, n]) => `${p}:${n}`)
          .join(",")}`,
      );
      decks = decks.map((d) =>
        d.id === deckId ? { ...d, pitchTargets: targets } : d,
      );
    },
    getFormatRules: async () => sampleRules,
    listHeroes: async () => [...(options.heroes ?? [])],
    listMatchups: async (deckId) => matchups.filter((m) => m.deckId === deckId),
    async saveMatchup(deckId, heroId, cards) {
      const kept = cards.filter((c) => c.quantity > 0);
      saved.push(
        `matchup ${deckId} ${heroId} ${[...kept]
          .sort((a, b) => a.variantId.localeCompare(b.variantId))
          .map((c) => `${c.variantId}:${c.quantity}`)
          .join(",")}`,
      );
      const existing = matchups.find(
        (m) => m.deckId === deckId && m.heroId === heroId,
      );
      const matchup: Matchup = {
        id: existing?.id ?? `matchup-${++nextMatchup}`,
        deckId,
        heroId,
        cards: kept,
      };
      matchups = [...matchups.filter((m) => m.id !== matchup.id), matchup];
      return matchup;
    },
    async deleteMatchup(id) {
      saved.push(`delete matchup ${id}`);
      matchups = matchups.filter((m) => m.id !== id);
    },
  };
  return { repository, saved };
}
