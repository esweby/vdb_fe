// Synergy rule weights, behind an interface so tests can use a fake. Anyone can read them (the
// ranking needs them, signed out too); only admins can change them (row level security).
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SynergyRepository {
  /** Admin-set weights by rule id. A rule with no entry uses its default in code. */
  listRuleWeights(): Promise<Record<string, number>>;
  setRuleWeight(ruleId: string, weight: number): Promise<void>;
  /** Back to the rule's default. */
  resetRuleWeight(ruleId: string): Promise<void>;
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
  };
}
