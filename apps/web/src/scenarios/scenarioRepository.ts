// Saved scenarios and their results, behind an interface so tests can use a fake. Row level
// security keeps each person to their own, plus the library; a link-shared scenario is read
// by id through shared_scenario().
import type { SupabaseClient } from "@supabase/supabase-js";
import { scenarioSchema, type ScenarioDefinition } from "@vdb/engine";

export type Visibility = "private" | "link" | "library";

export interface SavedScenario {
  id: string;
  definition: ScenarioDefinition;
  visibility: Visibility;
  /** The signed-in person's own (theirs to edit), rather than one from the library. */
  mine: boolean;
}

/** What a result was worked out from (README "Reproducibility"). */
export interface ResultInputs {
  deckSnapshot: string[];
  definition: unknown;
  definitionVersion: number;
  runs: number;
  engineVersion: string;
}

export interface SavedResult extends ResultInputs {
  scenarioId: string;
  deckId: string;
  seed: number;
  /** The success rate, or why it couldn't run on the deck. */
  outcome: { successRate: number } | { error: string };
  runAt: string;
}

export interface ScenarioRepository {
  /** The person's own scenarios and the library's. */
  listScenarios(userId: string): Promise<SavedScenario[]>;
  /** A scenario shared by link (or in the library, or one's own), or null. */
  getShared(id: string): Promise<SavedScenario | null>;
  saveScenario(
    userId: string,
    s: { id?: string; definition: ScenarioDefinition; visibility: Visibility },
  ): Promise<SavedScenario>;
  deleteScenario(id: string): Promise<void>;
  /** Curators only: in or out of the library. */
  setLibrary(id: string, inLibrary: boolean): Promise<void>;
  listResults(userId: string, deckId: string): Promise<SavedResult[]>;
  /** Replaces the person's earlier result for this scenario and deck. */
  saveResult(userId: string, result: SavedResult): Promise<void>;
}

interface ScenarioRow {
  id: string;
  user_id?: string;
  is_mine?: boolean;
  definition: unknown;
  visibility: Visibility;
}

/** A row's definition checked against the contract; one it doesn't understand is left out. */
function toSaved(row: ScenarioRow, userId?: string): SavedScenario | null {
  const parsed = scenarioSchema.safeParse(row.definition);
  if (!parsed.success) return null;
  return {
    id: row.id,
    definition: parsed.data,
    visibility: row.visibility,
    mine: row.is_mine ?? row.user_id === userId,
  };
}

export function supabaseScenarioRepository(
  client: SupabaseClient,
): ScenarioRepository {
  return {
    async listScenarios(userId) {
      const { data, error } = await client
        .from("scenarios")
        .select("id, user_id, definition, visibility")
        .order("name");
      if (error) throw error;
      return (data as ScenarioRow[])
        .map((r) => toSaved(r, userId))
        .filter((s): s is SavedScenario => s !== null);
    },
    async getShared(id) {
      const { data, error } = await client.rpc("shared_scenario", {
        scenario_id: id,
      });
      if (error) throw error;
      const row = (data as ScenarioRow[])[0];
      return row ? toSaved(row) : null;
    },
    async saveScenario(userId, s) {
      const row = {
        name: s.definition.name,
        definition: s.definition,
        definition_version: s.definition.version,
        visibility: s.visibility,
      };
      const query = s.id
        ? client.from("scenarios").update(row).eq("id", s.id)
        : client.from("scenarios").insert({ ...row, user_id: userId });
      const { data, error } = await query
        .select("id, user_id, definition, visibility")
        .single();
      if (error) throw error;
      return toSaved(data as ScenarioRow, userId)!;
    },
    async deleteScenario(id) {
      const { error } = await client.from("scenarios").delete().eq("id", id);
      if (error) throw error;
    },
    async setLibrary(id, inLibrary) {
      const { error } = await client.rpc("set_scenario_library", {
        scenario_id: id,
        in_library: inLibrary,
      });
      if (error) throw error;
    },
    async listResults(userId, deckId) {
      const { data, error } = await client
        .from("scenario_results")
        .select(
          "scenario_id, deck_id, deck_snapshot, definition, definition_version, seed, runs, engine_version, results, run_at",
        )
        .eq("user_id", userId)
        .eq("deck_id", deckId);
      if (error) throw error;
      return data.map((r) => ({
        scenarioId: r.scenario_id as string,
        deckId: r.deck_id as string,
        deckSnapshot: r.deck_snapshot as string[],
        definition: r.definition,
        definitionVersion: r.definition_version as number,
        seed: r.seed as number,
        runs: r.runs as number,
        engineVersion: r.engine_version as string,
        outcome: r.results as SavedResult["outcome"],
        runAt: r.run_at as string,
      }));
    },
    async saveResult(userId, r) {
      const { error } = await client.from("scenario_results").upsert(
        {
          user_id: userId,
          scenario_id: r.scenarioId,
          deck_id: r.deckId,
          deck_snapshot: r.deckSnapshot,
          definition: r.definition,
          definition_version: r.definitionVersion,
          seed: r.seed,
          runs: r.runs,
          engine_version: r.engineVersion,
          results: r.outcome,
          run_at: r.runAt,
        },
        { onConflict: "user_id,scenario_id,deck_id" },
      );
      if (error) throw error;
    },
  };
}
