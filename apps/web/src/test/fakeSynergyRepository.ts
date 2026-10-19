import type { SynergyRepository } from "../synergy/synergyRepository.ts";

/** An in-memory SynergyRepository; `saved` records every change. */
export function fakeSynergyRepository(weights: Record<string, number> = {}) {
  const current = { ...weights };
  const saved: string[] = [];
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
  };
  return { repository, saved };
}
