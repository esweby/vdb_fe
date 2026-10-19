import type { CommunityEdgeRow, CommunityFeedbackRow } from "@vdb/scoring";
import type {
  FeedbackRow,
  LinkRow,
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
  /** The signed-in person's own links. */
  myLinks: LinkRow[] = [],
) {
  let mine = [...myFeedback];
  let links = [...myLinks];
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
    listMyLinks: async (_userId, cardId) =>
      links.filter((l) => l.fromCardId === cardId || l.toCardId === cardId),
    async saveLinks(_userId, rows) {
      for (const r of rows) {
        saved.push(
          `link ${r.fromCardId}→${r.toCardId} ${r.weight}${r.note ? ` ${r.note}` : ""}`,
        );
      }
      const keys = new Set(rows.map((r) => `${r.fromCardId}→${r.toCardId}`));
      links = [
        ...links.filter((l) => !keys.has(`${l.fromCardId}→${l.toCardId}`)),
        ...rows,
      ];
    },
    async removeLink(_userId, from, to) {
      saved.push(`unlink ${from}→${to}`);
      links = links.filter((l) => l.fromCardId !== from || l.toCardId !== to);
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
