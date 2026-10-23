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

/**
 * Copies of a card in the pool: in the deck (the default loadout), or in the sideboard. A card
 * split between them has a row for each.
 */
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

/** An opposing hero for matchups (every adult hero playable in Classic Constructed). */
export interface Hero {
  id: string;
  name: string;
  classes: string[];
  talents: string[];
  imageUrl: string | null;
}

/** A named sideboard plan, optionally tied to an opposing hero. */
export interface Matchup {
  id: string;
  deckId: string;
  name: string;
  heroId: string | null;
  cards: { variantId: string; quantity: number }[];
}

export interface DeckSnapshot {
  schemaVersion: 1;
  name: string;
  hero: string;
  format: string;
  pitchTargets: PitchTargets;
  cards: (DeckCard & {
    externalId: string;
    name: string;
    pitch: number | null;
    type: string;
    subtypes: string[];
  })[];
  loadouts: {
    id: string;
    name: string;
    isDefault: boolean;
    opponentHeroId: string | null;
    opponentHeroName: string | null;
    cards: { variantId: string; quantity: number }[];
  }[];
}

export interface DeckVersion {
  id: string;
  deckId: string;
  number: number;
  createdAt: string;
  snapshot: DeckSnapshot;
  fabraryUrl: string | null;
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
  renameDeck(deckId: string, name: string): Promise<void>;
  /** Deletes the deck, with its cards, plans and scenario results. */
  deleteDeck(deckId: string): Promise<void>;
  getDeck(id: string): Promise<Deck | null>;
  /**
   * Adds, updates or (with quantity 0) removes a card's deck row or sideboard row. A card can have
   * both: some copies in the deck, the rest in the sideboard.
   */
  setCard(deckId: string, card: DeckCard): Promise<void>;
  setPitchTargets(deckId: string, targets: PitchTargets): Promise<void>;
  getFormatRules(): Promise<FormatRules>;
  /** Heroes a deck can face, by name. */
  listHeroes(): Promise<Hero[]>;
  /** The deck's matchup plans (its owner's only). */
  listMatchups(deckId: string): Promise<Matchup[]>;
  /** Saves the plan and its cards together. */
  saveMatchup(
    deckId: string,
    plan: Omit<Matchup, "id" | "deckId"> & { id?: string },
  ): Promise<Matchup>;
  deleteMatchup(id: string): Promise<void>;
  listVersions(deckId: string): Promise<DeckVersion[]>;
  saveVersion(deckId: string): Promise<DeckVersion>;
  setVersionLink(versionId: string, url: string | null): Promise<void>;
}

const INVALID_UUID = "22P02";
const SUMMARY =
  "id, name, updatedAt:updated_at, isPublic:is_public, ownerId:user_id, cards:deck_cards(variantId:variant_id, quantity, sideboard)";
const VERSION =
  "id, deckId:deck_id, number, createdAt:created_at, snapshot, fabraryUrl:fabrary_url";

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
    async listVersions(deckId) {
      const { data, error } = await client
        .from("deck_versions")
        .select(VERSION)
        .eq("deck_id", deckId)
        .order("number", { ascending: false });
      if (error) throw error;
      return data as DeckVersion[];
    },
    async saveVersion(deckId) {
      const { data, error } = await client
        .rpc("save_deck_version", { target_deck_id: deckId })
        .select(VERSION)
        .single();
      if (error) throw error;
      return data as DeckVersion;
    },
    async setVersionLink(versionId, url) {
      const { error } = await client
        .from("deck_versions")
        .update({ fabrary_url: url })
        .eq("id", versionId);
      if (error) throw error;
    },
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
    async renameDeck(deckId, name) {
      const { error } = await client
        .from("decks")
        .update({ name })
        .eq("id", deckId);
      if (error) throw error;
    },
    async deleteDeck(deckId) {
      const { error } = await client.from("decks").delete().eq("id", deckId);
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
              .eq("variant_id", card.variantId)
              .eq("sideboard", card.sideboard);
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
    async listHeroes() {
      const { data, error } = await client
        .from("heroes")
        .select("id, name, classes, talents, imageUrl:image_url")
        .eq("legal", true)
        .order("name");
      if (error) throw error;
      return data as Hero[];
    },
    async listMatchups(deckId) {
      const { data, error } = await client
        .from("deck_loadouts")
        .select(
          "id, deckId:deck_id, name, heroId:opponent_hero_id, cards:loadout_cards(variantId:variant_id, quantity)",
        )
        .eq("deck_id", deckId)
        .eq("is_default", false)
        .order("name");
      if (error) throw error;
      return data as Matchup[];
    },
    async saveMatchup(deckId, plan) {
      const cards = plan.cards.filter((card) => card.quantity > 0);
      const name = plan.name.trim();
      const { data, error } = await client.rpc("save_matchup", {
        target_deck_id: deckId,
        plan_name: name,
        opponent_id: plan.heroId,
        plan_cards: cards,
        target_loadout_id: plan.id ?? null,
      });
      if (error) throw error;
      return { id: data as string, deckId, name, heroId: plan.heroId, cards };
    },
    async deleteMatchup(id) {
      const { error } = await client
        .from("deck_loadouts")
        .delete()
        .eq("id", id);
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
