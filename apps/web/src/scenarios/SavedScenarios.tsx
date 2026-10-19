// The builder with the person's saved scenarios and the library (README "Saved scenarios"):
// save, edit, share, delete, and run them all against this deck with each result's inputs
// recorded, so a later run can say what changed.
import { ENGINE_VERSION, type ScenarioDefinition } from "@vdb/engine";
import { useCallback, useEffect, useState } from "react";
import { selectRole } from "../auth/authSlice.ts";
import type { DeckEntry } from "../decks/deckRules.ts";
import { useAppSelector } from "../hooks.ts";
import { runScenario } from "../ranking/runScenarios.ts";
import { RUNS } from "../ranking/scenarioRuns.ts";
import { useServices } from "../servicesContext.ts";
import { Button } from "../ui/index.ts";
import { deckSnapshot, differences } from "./results.ts";
import {
  ScenarioBuilder,
  VISIBILITY,
  type DeckForScenarios,
} from "./ScenarioBuilder.tsx";
import type {
  ResultInputs,
  SavedResult,
  SavedScenario,
  Visibility,
} from "./scenarioRepository.ts";
import styles from "./ScenarioBuilder.module.css";

const rate = (x: number) => `${(x * 100).toFixed(1)}%`;
/** Saved runs use one seed, so two decks' numbers compare like for like. */
const SEED = 1;

export function SavedScenarios(props: {
  deckId: string;
  entries: DeckEntry[];
  deck: DeckForScenarios;
}) {
  const { scenarios: repo } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const role = useAppSelector(selectRole);
  const canUseLibrary = role === "curator" || role === "admin";
  const [list, setList] = useState<SavedScenario[]>([]);
  const [results, setResults] = useState<SavedResult[]>([]);
  const [editing, setEditing] = useState<SavedScenario | undefined>();
  const [builderKey, setBuilderKey] = useState(0);
  const [runningAll, setRunningAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;

  const load = useCallback(async () => {
    if (!userId) return;
    const [s, r] = await Promise.all([
      repo.listScenarios(userId),
      repo.listResults(userId, props.deckId),
    ]);
    setList(s);
    setResults(r);
  }, [repo, userId, props.deckId]);
  useEffect(() => {
    load().catch(() => setError("Couldn't load your saved scenarios."));
  }, [load]);

  const snapshot = deckSnapshot(props.entries);
  const inputsNow = (definition: ScenarioDefinition): ResultInputs => ({
    deckSnapshot: snapshot,
    definition,
    definitionVersion: definition.version,
    runs: RUNS,
    engineVersion: ENGINE_VERSION,
  });

  function edit(s: SavedScenario | undefined) {
    setEditing(s);
    setBuilderKey((k) => k + 1);
  }

  async function save(
    definition: ScenarioDefinition,
    visibility: Visibility,
    id?: string,
  ) {
    if (!userId) return;
    try {
      const saved = await repo.saveScenario(userId, {
        id,
        definition,
        visibility,
      });
      await load();
      edit(saved);
    } catch {
      setError("Couldn't save the scenario.");
    }
  }

  async function remove(s: SavedScenario) {
    try {
      await repo.deleteScenario(s.id);
      if (editing?.id === s.id) edit(undefined);
      await load();
    } catch {
      setError("Couldn't delete the scenario.");
    }
  }

  async function copy(s: SavedScenario) {
    if (!userId) return;
    try {
      await repo.saveScenario(userId, {
        definition: s.definition,
        visibility: "private",
      });
      await load();
    } catch {
      setError("Couldn't copy the scenario.");
    }
  }

  async function runAll() {
    if (!userId) return;
    setRunningAll(true);
    setError(null);
    try {
      for (const s of list) {
        const output = await runScenario({
          definition: s.definition,
          ...props.deck,
          runs: RUNS,
          seed: SEED,
        });
        const result: SavedResult = {
          ...inputsNow(s.definition),
          scenarioId: s.id,
          deckId: props.deckId,
          seed: SEED,
          outcome: output.result
            ? { successRate: output.result.successRate }
            : { error: output.error ?? "It couldn't run." },
          runAt: new Date().toISOString(),
        };
        await repo.saveResult(userId, result);
        setResults((rs) => [
          result,
          ...rs.filter((r) => r.scenarioId !== s.id),
        ]);
      }
    } catch {
      setError("Couldn't run or record every scenario.");
    } finally {
      setRunningAll(false);
    }
  }

  function resultCell(s: SavedScenario) {
    const r = results.find((x) => x.scenarioId === s.id);
    if (!r) return <span className={styles.hint}>Not run on this deck</span>;
    const changed = differences(r, inputsNow(s.definition));
    return (
      <>
        {"successRate" in r.outcome ? (
          <span className={styles.cellRate}>{rate(r.outcome.successRate)}</span>
        ) : (
          <span className={styles.problem}>Can't run: {r.outcome.error}</span>
        )}
        {changed.length > 0 && (
          <span className={styles.stale}>
            {` Changed since: ${changed.join(", ")}`}
          </span>
        )}
      </>
    );
  }

  const mine = list.filter((s) => s.mine);
  const library = list.filter((s) => !s.mine);

  return (
    <>
      <ScenarioBuilder
        key={builderKey}
        deck={props.deck}
        editing={editing}
        onSave={userId ? save : undefined}
        canUseLibrary={canUseLibrary}
      />
      {error && (
        <p className={styles.problem} role="alert">
          {error}
        </p>
      )}
      {!userId ? (
        <p className={styles.hint}>
          Sign in to save scenarios and run them all.
        </p>
      ) : (
        <>
          <section className={styles.builder} aria-label="Your scenarios">
            <header className={styles.head}>
              <div>
                <h2>Your scenarios</h2>
                <p>
                  Run them all on this deck, with the library's. Each result is
                  kept with what it used, so a later change shows.
                </p>
              </div>
              <div className={styles.save}>
                {editing && (
                  <Button variant="ghost" onClick={() => edit(undefined)}>
                    New scenario
                  </Button>
                )}
                <Button
                  variant="primary"
                  disabled={runningAll || list.length === 0}
                  onClick={runAll}
                >
                  {runningAll ? "Running…" : "Run all"}
                </Button>
              </div>
            </header>
            {mine.length === 0 ? (
              <p className={styles.hint}>
                None saved yet. Build one above and save it.
              </p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Scenario</th>
                    <th scope="col">Who can see it</th>
                    <th scope="col">On this deck</th>
                    <th scope="col">
                      <span className={styles.visuallyHidden}>Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mine.map((s) => (
                    <tr key={s.id}>
                      <th scope="row">{s.definition.name}</th>
                      <td>{VISIBILITY[s.visibility]}</td>
                      <td>{resultCell(s)}</td>
                      <td className={styles.actions}>
                        <Button
                          variant="ghost"
                          aria-label={`Edit ${s.definition.name}`}
                          onClick={() => edit(s)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={`Delete ${s.definition.name}`}
                          onClick={() => remove(s)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          {library.length > 0 && (
            <section className={styles.builder} aria-label="Library">
              <header>
                <h2>Library</h2>
                <p className={styles.hint}>
                  Scenarios the curators picked. Run all includes them.
                </p>
              </header>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Scenario</th>
                    <th scope="col">On this deck</th>
                    <th scope="col">
                      <span className={styles.visuallyHidden}>Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {library.map((s) => (
                    <tr key={s.id}>
                      <th scope="row">{s.definition.name}</th>
                      <td>{resultCell(s)}</td>
                      <td className={styles.actions}>
                        <Button
                          variant="ghost"
                          aria-label={`Copy ${s.definition.name} to mine`}
                          onClick={() => copy(s)}
                        >
                          Copy to mine
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </>
  );
}
