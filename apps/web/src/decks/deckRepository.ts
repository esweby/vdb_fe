// Decks (yours, and anyone's public ones), behind an interface so tests can use a fake.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormatRules } from "./deckRules.ts";

export interface DeckSummary {
  id: string;
  name: string;
  updatedAt: string;
  /** Anyone can see a public deck; a private one only its owner. */
  isPublic: boolean;
  ownerId: string;
  /** The owner's username, if they've chosen one (shown on public decks). */
  ownerName?: string | null;
  cards: DeckCard[];
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
  pitchTargets: PitchTargets;
}

export interface DeckRepository {
  /** The user's own decks, public and private, most recently changed first. */
  listMyDecks(userId: string): Promise<DeckSummary[]>;
  /** Everyone's public decks, most recently changed first. */
  listPublicDecks(): Promise<DeckSummary[]>;
  createDeck(
    name: string,
    options?: { isPublic?: boolean },
  ): Promise<DeckSummary>;
  setVisibility(deckId: string, isPublic: boolean): Promise<void>;
  getDeck(id: string): Promise<Deck | null>;
  /** Adds, updates or (with quantity 0) removes a card in the pool. */
  setCard(deckId: string, card: DeckCard): Promise<void>;
  setPitchTargets(deckId: string, targets: PitchTargets): Promise<void>;
  getFormatRules(): Promise<FormatRules>;
}

const INVALID_UUID = "22P02";
const SUMMARY =
  "id, name, updatedAt:updated_at, isPublic:is_public, ownerId:user_id, cards:deck_cards(variantId:variant_id, quantity, sideboard)";

export function supabaseDeckRepository(client: SupabaseClient): DeckRepository {
  /** Adds each owner's username, read through public.usernames() (profiles stay private). */
  async function withOwnerNames<T extends { ownerId: string }>(
    decks: T[],
  ): Promise<(T & { ownerName: string | null })[]> {
    const ids = [...new Set(decks.map((d) => d.ownerId))];
    if (ids.length === 0) return [];
    const { data, error } = await client.rpc("usernames", { ids });
    if (error) throw error;
    const names = new Map(
      (data as { id: string; username: string }[]).map((r) => [
        r.id,
        r.username,
      ]),
    );
    return decks.map((d) => ({
      ...d,
      ownerName: names.get(d.ownerId) ?? null,
    }));
  }

  return {
    async listMyDecks(userId) {
      // Public decks are readable too, so filter by owner.
      const { data, error } = await client
        .from("decks")
        .select(SUMMARY)
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as DeckSummary[];
    },
    async listPublicDecks() {
      const { data, error } = await client
        .from("decks")
        .select(SUMMARY)
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return withOwnerNames(data as DeckSummary[]);
    },
    async createDeck(name, options) {
      const { data, error } = await client
        .from("decks")
        .insert({ name, is_public: options?.isPublic ?? false })
        .select(SUMMARY)
        .single();
      if (error) throw error;
      return data as DeckSummary;
    },
    async setVisibility(deckId, isPublic) {
      const { error } = await client
        .from("decks")
        .update({ is_public: isPublic })
        .eq("id", deckId);
      if (error) throw error;
    },
    async getDeck(id) {
      const { data, error } = await client
        .from("decks")
        .select(`${SUMMARY}, pitchTargets:pitch_targets`)
        .eq("id", id)
        .maybeSingle();
      if (error?.code === INVALID_UUID) return null;
      if (error) throw error;
      return data ? (await withOwnerNames([data as Deck]))[0]! : null;
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
    async setPitchTargets(deckId, targets) {
      const { error } = await client
        .from("decks")
        .update({
          pitch_targets: targets,
          updated_at: new Date().toISOString(),
        })
        .eq("id", deckId);
      if (error) throw error;
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
