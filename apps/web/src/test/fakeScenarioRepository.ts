import type {
  SavedResult,
  SavedScenario,
  ScenarioRepository,
} from "../scenarios/scenarioRepository.ts";

type Stored = Omit<SavedScenario, "mine"> & { userId: string };

/** An in-memory ScenarioRepository, with row level security's rules; `saved` records changes. */
export function fakeScenarioRepository(
  initial: { scenarios?: Stored[]; results?: SavedResult[] } = {},
) {
  let rows = [...(initial.scenarios ?? [])];
  const results = [...(initial.results ?? [])];
  const saved: string[] = [];
  let next = 0;
  const view = (r: Stored, userId?: string): SavedScenario => ({
    id: r.id,
    definition: r.definition,
    visibility: r.visibility,
    mine: r.userId === userId,
  });
  const repository: ScenarioRepository = {
    listScenarios: async (userId) =>
      rows
        .filter((r) => r.userId === userId || r.visibility === "library")
        .map((r) => view(r, userId)),
    getShared: async (id) => {
      const r = rows.find((x) => x.id === id && x.visibility !== "private");
      return r ? view(r) : null;
    },
    async saveScenario(userId, s) {
      if (s.id) {
        saved.push(`update ${s.id} ${s.definition.name} ${s.visibility}`);
        rows = rows.map((r) =>
          r.id === s.id
            ? { ...r, definition: s.definition, visibility: s.visibility }
            : r,
        );
        return view(
          rows.find((r) => r.id === s.id)!,
          userId,
        );
      }
      saved.push(`save ${s.definition.name} ${s.visibility}`);
      const row = {
        id: `scenario-${++next}`,
        userId,
        definition: s.definition,
        visibility: s.visibility,
      };
      rows.push(row);
      return view(row, userId);
    },
    async deleteScenario(id) {
      saved.push(`delete ${id}`);
      rows = rows.filter((r) => r.id !== id);
    },
    async setLibrary(id, inLibrary) {
      saved.push(`library ${id} ${inLibrary}`);
      rows = rows.map((r) =>
        r.id === id ? { ...r, visibility: inLibrary ? "library" : "link" } : r,
      );
    },
    listResults: async (_userId, deckId) =>
      results.filter((r) => r.deckId === deckId),
    async saveResult(_userId, r) {
      const i = results.findIndex(
        (x) => x.scenarioId === r.scenarioId && x.deckId === r.deckId,
      );
      if (i >= 0) results.splice(i, 1);
      results.unshift(r);
    },
  };
  return { repository, saved, results };
}
