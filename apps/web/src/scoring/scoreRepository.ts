// Card details, score dimensions and the signed-in user's scores.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthoredCardAttributes, CardAttributes } from "@vdb/cards";
import type { Side } from "@vdb/scoring";

export interface Dimension {
  id: number;
  key: string;
  label: string;
}

export interface ScoreKey {
  /** null = card level */
  variantId: string | null;
  /** null = both sides */
  side: Side | null;
  dimensionId: number;
}

export interface ScoreRow extends ScoreKey {
  score: number;
}

export interface CardDetail {
  id: string;
  name: string;
  type: string;
  classes: string[];
  talents: string[];
  /** null when the variants' text differs */
  text: string | null;
  attributes: CardAttributes;
  attributesVerified: boolean;
  variants: {
    id: string;
    pitch: number | null;
    text: string | null;
    /** Overrides for this pitch, merged over the card's attributes. */
    attributes: AuthoredCardAttributes;
  }[];
}

export interface ScoreRepository {
  getCard(cardId: string): Promise<CardDetail | null>;
  listDimensions(): Promise<Dimension[]>;
  listMyScores(userId: string, cardId: string): Promise<ScoreRow[]>;
  saveScore(cardId: string, key: ScoreKey, score: number): Promise<void>;
  clearScore(cardId: string, key: ScoreKey): Promise<void>;
  /** When the signed-in user marked this card reviewed, or null. */
  getMyReview(userId: string, cardId: string): Promise<string | null>;
  /** Marks the card reviewed; returns the timestamp. */
  markReviewed(cardId: string): Promise<string>;
  /** Asks the community score job to recalculate (scorers only; the function checks). */
  runCommunityJob(): Promise<void>;
  listMyReviewedCardIds(userId: string): Promise<string[]>;
  getPreferences(userId: string): Promise<Preferences>;
  savePreferences(userId: string, preferences: Preferences): Promise<void>;
}

export interface Preferences {
  /** Default for "Same score for both sides" on card pages. Defaults to true. */
  scoreSidesTogether?: boolean;
}

export function supabaseScoreRepository(
  client: SupabaseClient,
): ScoreRepository {
  const userId = async () => {
    const { data } = await client.auth.getUser();
    if (!data.user) throw new Error("Not signed in");
    return data.user.id;
  };

  return {
    async getCard(cardId) {
      const { data, error } = await client
        .from("cards")
        .select(
          "id, name, type, classes, talents, text, attributes, attributes_verified, variants(id, pitch, text, attributes)",
        )
        .eq("id", cardId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { attributes_verified, variants, ...card } = data;
      return {
        ...card,
        attributesVerified: attributes_verified,
        variants: [...variants].sort((a, b) => (a.pitch ?? 0) - (b.pitch ?? 0)),
      } as CardDetail;
    },
    async listDimensions() {
      const { data, error } = await client
        .from("score_dimensions")
        .select("id, key, label")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    async listMyScores(user, cardId) {
      const { data, error } = await client
        .from("card_scores")
        .select("variant_id, side, dimension_id, score")
        .eq("user_id", user)
        .eq("card_id", cardId);
      if (error) throw error;
      return data.map((r) => ({
        variantId: r.variant_id,
        side: r.side,
        dimensionId: r.dimension_id,
        score: r.score,
      }));
    },
    async saveScore(cardId, key, score) {
      const { error } = await client.from("card_scores").upsert(
        {
          user_id: await userId(),
          card_id: cardId,
          variant_id: key.variantId,
          side: key.side,
          dimension_id: key.dimensionId,
          score,
        },
        { onConflict: "user_id,card_id,variant_id,side,dimension_id" },
      );
      if (error) throw error;
    },
    async getMyReview(user, cardId) {
      const { data, error } = await client
        .from("card_reviews")
        .select("reviewed_at")
        .eq("user_id", user)
        .eq("card_id", cardId)
        .maybeSingle();
      if (error) throw error;
      return data?.reviewed_at ?? null;
    },
    async markReviewed(cardId) {
      const { data, error } = await client
        .from("card_reviews")
        .upsert(
          {
            user_id: await userId(),
            card_id: cardId,
            reviewed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,card_id" },
        )
        .select("reviewed_at")
        .single();
      if (error) throw error;
      return data.reviewed_at;
    },
    async listMyReviewedCardIds(user) {
      const { data, error } = await client
        .from("card_reviews")
        .select("card_id")
        .eq("user_id", user);
      if (error) throw error;
      return data.map((r) => r.card_id);
    },
    async getPreferences(user) {
      const { data, error } = await client
        .from("profiles")
        .select("preferences")
        .eq("id", user)
        .single();
      if (error) throw error;
      return (data.preferences ?? {}) as Preferences;
    },
    async savePreferences(user, preferences) {
      const { error } = await client
        .from("profiles")
        .update({ preferences })
        .eq("id", user);
      if (error) throw error;
    },
    async runCommunityJob() {
      const { error } = await client.functions.invoke("community-scores", {
        method: "POST",
      });
      if (error) throw error;
    },
    async clearScore(cardId, key) {
      let query = client
        .from("card_scores")
        .delete()
        .eq("user_id", await userId())
        .eq("card_id", cardId)
        .eq("dimension_id", key.dimensionId);
      query =
        key.variantId === null
          ? query.is("variant_id", null)
          : query.eq("variant_id", key.variantId);
      query =
        key.side === null ? query.is("side", null) : query.eq("side", key.side);
      const { error } = await query;
      if (error) throw error;
    },
  };
}
