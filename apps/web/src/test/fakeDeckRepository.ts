import type { Deck, DeckRepository } from "../decks/deckRepository.ts";
import type { FormatRules } from "../decks/deckRules.ts";

export const sampleRules: FormatRules = {
  copyLimit: 3,
  deckMin: 60,
  poolMax: 80,
  weaponHands: 2,
};

/** An in-memory DeckRepository; `saved` records every write. */
export function fakeDeckRepository(initial: Deck[] = []) {
  let decks = initial.map((d) => ({ ...d, cards: [...d.cards] }));
  const saved: string[] = [];
  const repository: DeckRepository = {
    listDecks: async () =>
      decks.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })),
    async createDeck(name) {
      saved.push(`create ${name}`);
      const deck = {
        id: `deck-${decks.length + 1}`,
        name,
        updatedAt: "2026-10-14T12:00:00Z",
        cards: [],
        pitchTargets: {},
      };
      decks = [...decks, deck];
      return { id: deck.id, name, updatedAt: deck.updatedAt };
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
  };
  return { repository, saved };
}
