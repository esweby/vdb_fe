// Admins' verdicts on effect drafts (docs/rules-engine.md, step 9b), keyed by the draft's hash
// so a verdict goes stale when the card's facts change. Behind an interface so tests use a fake.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DraftReview {
  cardId: string;
  draftHash: string;
  verdict: "accepted" | "rejected";
  note: string | null;
}

export interface DraftReviewRepository {
  listReviews(): Promise<DraftReview[]>;
  /** Admins only (row level security). */
  saveReview(review: DraftReview): Promise<void>;
  clearReview(cardId: string, draftHash: string): Promise<void>;
}

export function supabaseDraftReviewRepository(
  client: SupabaseClient,
): DraftReviewRepository {
  return {
    async listReviews() {
      const rows: DraftReview[] = [];
      // PostgREST returns at most 1,000 rows per request.
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client
          .from("effect_draft_reviews")
          .select("cardId:card_id, draftHash:draft_hash, verdict, note")
          .order("card_id")
          .order("draft_hash")
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...(data as DraftReview[]));
        if (data.length < 1000) return rows;
      }
    },
    async saveReview(review) {
      const { error } = await client.from("effect_draft_reviews").upsert({
        card_id: review.cardId,
        draft_hash: review.draftHash,
        verdict: review.verdict,
        note: review.note,
      });
      if (error) throw error;
    },
    async clearReview(cardId, draftHash) {
      const { error } = await client
        .from("effect_draft_reviews")
        .delete()
        .eq("card_id", cardId)
        .eq("draft_hash", draftHash);
      if (error) throw error;
    },
  };
}
