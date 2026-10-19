import type { CommunityEdgeRow, CommunityFeedbackRow } from "@vdb/scoring";
import type {
  FeedbackRow,
  SynergyRepository,
} from "../synergy/synergyRepository.ts";

/** An in-memory SynergyRepository; `saved` records every change. */
export function fakeSynergyRepository(
  weights: Record<string, number> = {},
  community: { edges: CommunityEdgeRow[]; feedback: CommunityFeedbackRow[] } = {
    edges: [],
    feedback: [],
  },
  /** The signed-in person's own verdicts. */
  myFeedback: FeedbackRow[] = [],
) {
  let mine = [...myFeedback];
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
    listMyFeedback: async () => [...mine],
    async saveFeedback(_userId, rows) {
      for (const r of rows) {
        saved.push(
          `feedback ${r.verdict}${r.weight === null ? "" : ` ${r.weight}`} ${r.ruleId} ${r.fromCardId}→${r.toCardId}`,
        );
      }
      mine = [...mine, ...rows];
    },
    async clearFeedback(_userId, from, to) {
      saved.push(`clear feedback ${from}→${to}`);
      mine = mine.filter((r) => r.fromCardId !== from || r.toCardId !== to);
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
