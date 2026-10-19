// Synergy rule weights, behind an interface so tests can use a fake. Anyone can read them (the
// ranking needs them, signed out too); only admins can change them (row level security).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommunityEdgeRow, CommunityFeedbackRow } from "@vdb/scoring";

/** One person's verdict on one rule's link (synergy_feedback). */
export interface FeedbackRow {
  ruleId: string;
  fromCardId: string;
  toCardId: string;
  verdict: "confirm" | "reject" | "reweight";
  /** Only for a reweight. */
  weight: number | null;
}

/** One person's own link (card_synergies): "from helps to". */
export interface LinkRow {
  fromCardId: string;
  toCardId: string;
  weight: number;
  note: string | null;
}

export interface SynergyRepository {
  /** Admin-set weights by rule id. A rule with no entry uses its default in code. */
  listRuleWeights(): Promise<Record<string, number>>;
  setRuleWeight(ruleId: string, weight: number): Promise<void>;
  /** Back to the rule's default. */
  resetRuleWeight(ruleId: string): Promise<void>;
  listMyFeedback(userId: string): Promise<FeedbackRow[]>;
  saveFeedback(userId: string, rows: FeedbackRow[]): Promise<void>;
  /** Takes back every verdict on one link (Undo in the queue). */
  clearFeedback(
    userId: string,
    fromCardId: string,
    toCardId: string,
  ): Promise<void>;
  /** The signed-in person's links to or from a card (the related-cards picker). */
  listMyLinks(userId: string, cardId: string): Promise<LinkRow[]>;
  saveLinks(userId: string, rows: LinkRow[]): Promise<void>;
  removeLink(
    userId: string,
    fromCardId: string,
    toCardId: string,
  ): Promise<void>;
  /** The scoring group's own links and their feedback on derived links (community-scores job). */
  listCommunitySynergies(): Promise<{
    edges: CommunityEdgeRow[];
    feedback: CommunityFeedbackRow[];
  }>;
}

export function supabaseSynergyRepository(
  client: SupabaseClient,
): SynergyRepository {
  return {
    async listRuleWeights() {
      const { data, error } = await client
        .from("synergy_rule_weights")
        .select("rule_id, weight");
      if (error) throw error;
      return Object.fromEntries(
        data.map((r) => [r.rule_id as string, Number(r.weight)]),
      );
    },
    async setRuleWeight(ruleId, weight) {
      const { error } = await client
        .from("synergy_rule_weights")
        .upsert({ rule_id: ruleId, weight });
      if (error) throw error;
    },
    async resetRuleWeight(ruleId) {
      const { error } = await client
        .from("synergy_rule_weights")
        .delete()
        .eq("rule_id", ruleId);
      if (error) throw error;
    },
    async listMyFeedback(userId) {
      const rows: FeedbackRow[] = [];
      // PostgREST returns at most 1,000 rows per request.
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client
          .from("synergy_feedback")
          .select(
            "ruleId:rule_id, fromCardId:from_card_id, toCardId:to_card_id, verdict, weight",
          )
          .eq("user_id", userId)
          .range(from, from + 999);
        if (error) throw error;
        rows.push(
          ...(data.map((r) => ({
            ...r,
            weight: r.weight === null ? null : Number(r.weight),
          })) as FeedbackRow[]),
        );
        if (data.length < 1000) return rows;
      }
    },
    async saveFeedback(userId, rows) {
      const { error } = await client.from("synergy_feedback").upsert(
        rows.map((r) => ({
          user_id: userId,
          rule_id: r.ruleId,
          from_card_id: r.fromCardId,
          to_card_id: r.toCardId,
          verdict: r.verdict,
          weight: r.weight,
          updated_at: new Date().toISOString(),
        })),
      );
      if (error) throw error;
    },
    async clearFeedback(userId, fromCardId, toCardId) {
      const { error } = await client
        .from("synergy_feedback")
        .delete()
        .eq("user_id", userId)
        .eq("from_card_id", fromCardId)
        .eq("to_card_id", toCardId);
      if (error) throw error;
    },
    async listMyLinks(userId, cardId) {
      const { data, error } = await client
        .from("card_synergies")
        .select("fromCardId:from_card_id, toCardId:to_card_id, weight, note")
        .eq("user_id", userId)
        .or(`from_card_id.eq.${cardId},to_card_id.eq.${cardId}`);
      if (error) throw error;
      return data.map((r) => ({ ...r, weight: Number(r.weight) })) as LinkRow[];
    },
    async saveLinks(userId, rows) {
      const { error } = await client.from("card_synergies").upsert(
        rows.map((r) => ({
          user_id: userId,
          from_card_id: r.fromCardId,
          to_card_id: r.toCardId,
          weight: r.weight,
          note: r.note,
          updated_at: new Date().toISOString(),
        })),
      );
      if (error) throw error;
    },
    async removeLink(userId, fromCardId, toCardId) {
      const { error } = await client
        .from("card_synergies")
        .delete()
        .eq("user_id", userId)
        .eq("from_card_id", fromCardId)
        .eq("to_card_id", toCardId);
      if (error) throw error;
    },
    async listCommunitySynergies() {
      const [edges, feedback] = await Promise.all([
        client
          .from("community_synergies")
          .select(
            "fromCardId:from_card_id, toCardId:to_card_id, weight, ratingCount:rating_count, totalWeight:total_weight",
          ),
        client
          .from("community_synergy_feedback")
          .select(
            "ruleId:rule_id, fromCardId:from_card_id, toCardId:to_card_id, confirmShare:confirm_share, fixedPart:fixed_part, ratingCount:rating_count, totalWeight:total_weight",
          ),
      ]);
      if (edges.error) throw edges.error;
      if (feedback.error) throw feedback.error;
      // numeric columns come back as strings.
      return {
        edges: edges.data.map((e) => ({
          ...e,
          weight: Number(e.weight),
          totalWeight: Number(e.totalWeight),
        })) as CommunityEdgeRow[],
        feedback: feedback.data.map((f) => ({
          ...f,
          confirmShare: Number(f.confirmShare),
          fixedPart: Number(f.fixedPart),
          totalWeight: Number(f.totalWeight),
        })) as CommunityFeedbackRow[],
      };
    },
  };
}
