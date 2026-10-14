// The signed-in user's decks, behind an interface so tests can use a fake.
import type { FormatRules } from "./deckRules.ts";

export interface DeckSummary {
  id: string;
  name: string;
  updatedAt: string;
}

/** A card in the pool. Main deck cards (sideboard false) are in the default loadout. */
export interface DeckCard {
  variantId: string;
  quantity: number;
  sideboard: boolean;
}

export interface Deck extends DeckSummary {
  cards: DeckCard[];
}

export interface DeckRepository {
  listDecks(): Promise<DeckSummary[]>;
  createDeck(name: string): Promise<DeckSummary>;
  getDeck(id: string): Promise<Deck | null>;
  /** Adds, updates or (with quantity 0) removes a card in the pool. */
  setCard(deckId: string, card: DeckCard): Promise<void>;
  getFormatRules(): Promise<FormatRules>;
}
