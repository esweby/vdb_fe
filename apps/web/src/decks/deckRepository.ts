// The signed-in user's decks, behind an interface so tests can use a fake.
import type { SupabaseClient } from "@supabase/supabase-js";
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

/** Target number of deck cards per pitch (1 red, 2 yellow, 3 blue); missing = no target. */
export type PitchTargets = Partial<Record<1 | 2 | 3, number>>;

export interface Deck extends DeckSummary {
  cards: DeckCard[];
  pitchTargets: PitchTargets;
}

export interface DeckRepository {
  listDecks(): Promise<DeckSummary[]>;
  createDeck(name: string): Promise<DeckSummary>;
  getDeck(id: string): Promise<Deck | null>;
  /** Adds, updates or (with quantity 0) removes a card in the pool. */
  setCard(deckId: string, card: DeckCard): Promise<void>;
  setPitchTargets(deckId: string, targets: PitchTargets): Promise<void>;
  getFormatRules(): Promise<FormatRules>;
}

const INVALID_UUID = "22P02";

export function supabaseDeckRepository(client: SupabaseClient): DeckRepository {
  return {
    async listDecks() {
      const { data, error } = await client
        .from("decks")
        .select("id, name, updatedAt:updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    async createDeck(name) {
      const { data, error } = await client
        .from("decks")
        .insert({ name })
        .select("id, name, updatedAt:updated_at")
        .single();
      if (error) throw error;
      return data;
    },
    async getDeck(id) {
      const { data, error } = await client
        .from("decks")
        .select(
          "id, name, updatedAt:updated_at, cards:deck_cards(variantId:variant_id, quantity, sideboard)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error?.code === INVALID_UUID) return null;
      if (error) throw error;
      return data;
    },
    async setCard(deckId, card) {
      const { error } =
        card.quantity > 0
          ? await client.from("deck_cards").upsert({
              deck_id: deckId,
              variant_id: card.variantId,
              quantity: card.quantity,
              sideboard: card.sideboard,
            })
          : await client
              .from("deck_cards")
              .delete()
              .eq("deck_id", deckId)
              .eq("variant_id", card.variantId);
      if (error) throw error;
      await client
        .from("decks")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", deckId);
    },
    async getFormatRules() {
      const { data, error } = await client
        .from("app_settings")
        .select("value")
        .eq("key", "format_classic_constructed")
        .single();
      if (error) throw error;
      return data.value as FormatRules;
    },
  };
}
