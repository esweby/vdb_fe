// Synergy rule weights, behind an interface so tests can use a fake. Anyone can read them (the
// ranking needs them, signed out too); only admins can change them (row level security).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommunityEdgeRow, CommunityFeedbackRow } from "@vdb/scoring";

export interface SynergyRepository {
  /** Admin-set weights by rule id. A rule with no entry uses its default in code. */
  listRuleWeights(): Promise<Record<string, number>>;
  setRuleWeight(ruleId: string, weight: number): Promise<void>;
  /** Back to the rule's default. */
  resetRuleWeight(ruleId: string): Promise<void>;
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
