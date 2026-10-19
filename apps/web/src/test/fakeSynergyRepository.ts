import type { CommunityEdgeRow, CommunityFeedbackRow } from "@vdb/scoring";
import type { SynergyRepository } from "../synergy/synergyRepository.ts";

/** An in-memory SynergyRepository; `saved` records every change. */
export function fakeSynergyRepository(
  weights: Record<string, number> = {},
  community: { edges: CommunityEdgeRow[]; feedback: CommunityFeedbackRow[] } = {
    edges: [],
    feedback: [],
  },
) {
  const current = { ...weights };
  const saved: string[] = [];
  const counts = { loads: 0 };
  const repository: SynergyRepository = {
    listRuleWeights: async () => ({ ...current }),
    async setRuleWeight(ruleId, weight) {
      saved.push(`set ${ruleId} ${weight}`);
      current[ruleId] = weight;
    },
    async resetRuleWeight(ruleId) {
      saved.push(`reset ${ruleId}`);
      delete current[ruleId];
    },
    async listCommunitySynergies() {
      counts.loads += 1;
      return community;
    },
  };
  return {
    repository,
    saved,
    /** How many times the scoring group's links were loaded. */
    get loads() {
      return counts.loads;
    },
  };
}
