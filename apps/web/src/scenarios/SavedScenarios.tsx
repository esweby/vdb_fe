// The builder with the person's saved scenarios and the library (README "Saved scenarios"):
// save, edit, share, delete, and run them all against this deck with each result's inputs
// recorded, so a later run can say what changed. Compare decks (README "Saved scenarios",
// phase two step 8): run them on another of your decks too, side by side, with the same seed.
import { ENGINE_VERSION, type ScenarioDefinition } from "@vdb/engine";
import { useCallback, useEffect, useState } from "react";
import { selectRole } from "../auth/authSlice.ts";
import { useCards } from "../cards/useCards.ts";
import type { DeckSummary } from "../decks/deckRepository.ts";
import type { DeckEntry } from "../decks/deckRules.ts";
import { useAppSelector } from "../hooks.ts";
import { runScenario } from "../ranking/runScenarios.ts";
import { RUNS } from "../ranking/scenarioRuns.ts";
import { useServices } from "../servicesContext.ts";
import { Button } from "../ui/index.ts";
import { deckSnapshot, differences } from "./results.ts";
import { entriesOf, scenarioDeck } from "./scenarioDeck.ts";
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
  /** Running saved scenarios, or creating one in the builder (the maintainer, 20 Oct 2026). */
  mode: "run" | "create";
  onMode: (mode: "run" | "create") => void;
}) {
  const { scenarios: repo, decks } = useServices();
  const { items: pool } = useCards();
  const [myDecks, setMyDecks] = useState<DeckSummary[]>([]);
  const [other, setOther] = useState<{
    id: string;
    name: string;
    entries: DeckEntry[];
  } | null>(null);
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
  useEffect(() => {
    if (!userId) return;
    decks.listMyDecks(userId).then(setMyDecks, () => setMyDecks([]));
  }, [decks, userId]);

  async function compareWith(id: string) {
    if (!userId || !id) return setOther(null);
    try {
      const [deck, theirResults] = await Promise.all([
        decks.getDeck(id),
        repo.listResults(userId, id),
      ]);
      if (!deck) return setOther(null);
      setOther({ id, name: deck.name, entries: entriesOf(deck.cards, pool) });
      setResults((rs) => [
        ...rs.filter((r) => r.deckId !== id),
        ...theirResults,
      ]);
    } catch {
      setError("Couldn't load that deck.");
    }
  }

  const snapshots: Record<string, string[]> = {
    [props.deckId]: deckSnapshot(props.entries),
    ...(other ? { [other.id]: deckSnapshot(other.entries) } : {}),
  };
  const inputsNow = (
    definition: ScenarioDefinition,
    deckId = props.deckId,
  ): ResultInputs => ({
    deckSnapshot: snapshots[deckId] ?? [],
    definition,
    definitionVersion: definition.version,
    runs: RUNS,
    engineVersion: ENGINE_VERSION,
  });

  function edit(s: SavedScenario | undefined) {
    setEditing(s);
    setBuilderKey((k) => k + 1);
  }
  /** Opens the builder, on a saved scenario or a new one. */
  function create(s?: SavedScenario) {
    edit(s);
    props.onMode("create");
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
    const targets = [
      { deckId: props.deckId, deck: props.deck },
      ...(other
        ? [
            {
              deckId: other.id,
              deck: scenarioDeck(other.entries),
            },
          ]
        : []),
    ];
    try {
      for (const s of list)
        for (const { deckId, deck } of targets) {
          const output = await runScenario({
            definition: s.definition,
            ...deck,
            runs: RUNS,
            seed: SEED,
          });
          const result: SavedResult = {
            ...inputsNow(s.definition, deckId),
            scenarioId: s.id,
            deckId,
            seed: SEED,
            outcome: output.result
              ? { successRate: output.result.successRate }
              : { error: output.error ?? "It couldn't run." },
            runAt: new Date().toISOString(),
          };
          await repo.saveResult(userId, result);
          setResults((rs) => [
            result,
            ...rs.filter(
              (r) => !(r.scenarioId === s.id && r.deckId === deckId),
            ),
          ]);
        }
    } catch {
      setError("Couldn't run or record every scenario.");
    } finally {
      setRunningAll(false);
    }
  }

  const resultOf = (s: SavedScenario, deckId: string) =>
    results.find((x) => x.scenarioId === s.id && x.deckId === deckId);
  const rateOf = (s: SavedScenario, deckId: string) => {
    const o = resultOf(s, deckId)?.outcome;
    return o && "successRate" in o ? o.successRate : null;
  };

  /** The compared deck's columns: its result, and how far it is from this deck's. */
  function compareCells(s: SavedScenario) {
    if (!other) return null;
    const here = rateOf(s, props.deckId);
    const there = rateOf(s, other.id);
    const diff = here !== null && there !== null ? (there - here) * 100 : null;
    return (
      <>
        <td>{resultCell(s, other.id)}</td>
        <td className={styles.cellRate}>
          {diff === null
            ? "–"
            : `${diff >= 0 ? "+" : "−"}${Math.abs(diff).toFixed(1)} pts`}
        </td>
      </>
    );
  }
  const compareHeads = other && (
    <>
      <th scope="col">{`On ${other.name}`}</th>
      <th scope="col">Difference</th>
    </>
  );

  function resultCell(s: SavedScenario, deckId = props.deckId) {
    const r = resultOf(s, deckId);
    if (!r) return <span className={styles.hint}>Not run yet</span>;
    const changed = differences(r, inputsNow(s.definition, deckId));
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

  const errorLine = error && (
    <p className={styles.problem} role="alert">
      {error}
    </p>
  );
  if (props.mode === "create")
    return (
      <div className={styles.createLayout}>
        <div>
          <ScenarioBuilder
            key={builderKey}
            deck={props.deck}
            deckId={props.deckId}
            editing={editing}
            onSave={userId ? save : undefined}
            canUseLibrary={canUseLibrary}
          />
          {errorLine}
        </div>
        <ScenarioGuide signedIn={!!userId} />
      </div>
    );

  return (
    <>
      {errorLine}
      <div className={styles.addRow}>
        <Button variant="primary" onClick={() => create()}>
          Add a new scenario
        </Button>
      </div>
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
                <label className={styles.select}>
                  <span>Compare with</span>
                  <select
                    value={other?.id ?? ""}
                    onChange={(e) => void compareWith(e.target.value)}
                  >
                    <option value="">No other deck</option>
                    {myDecks
                      .filter((d) => d.id !== props.deckId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </label>
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
                None saved yet. Add a new scenario to build one and save it.
              </p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Scenario</th>
                    <th scope="col">Who can see it</th>
                    <th scope="col">On this deck</th>
                    {compareHeads}
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
                      {compareCells(s)}
                      <td className={styles.actions}>
                        <Button
                          variant="ghost"
                          aria-label={`Edit ${s.definition.name}`}
                          onClick={() => create(s)}
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
                    {compareHeads}
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
                      {compareCells(s)}
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

/** What each part of a scenario expects, beside the builder (the maintainer, 20 Oct 2026). */
function ScenarioGuide(props: { signedIn: boolean }) {
  return (
    <aside aria-label="How a scenario works" className={styles.guide}>
      <h2>How a scenario works</h2>
      <p>
        A scenario asks a question about this deck's hands, like "do I have a
        Gate maker and a blood debt card by turn 2?". It shuffles the deck
        thousands of times and counts how often the answer is yes. It counts
        what's visible; it doesn't play the game.
      </p>
      <dl>
        <dt>When</dt>
        <dd>
          The turn the question is asked: the opening hand, or after a turn or
          more of draws.
        </dd>
        <dt>Starting with</dt>
        <dd>
          Optional. Cards you already hold in hand or arsenal, for "what if I
          open with this?".
        </dd>
        <dt>Each turn</dt>
        <dd>
          Optional. Fixed steps after each draw, like putting a blue card in
          arsenal. Only for checks after turn 1.
        </dd>
        <dt>Look at</dt>
        <dd>
          Where the cards may be: hand, arsenal, banished and so on. Weapons and
          equipment always count.
        </dd>
        <dt>Succeeds if</dt>
        <dd>
          The answer: which cards, by name, pitch or role, and how many. Group
          them with "All of these" or "Any of these".
        </dd>
      </dl>
      <p>
        {props.signedIn
          ? "Then: Run this scenario to try it here. Save it to add it to your scenarios, where Run all checks it on this deck with the rest."
          : "Then: Run this scenario to try it here. Sign in to save it."}
      </p>
    </aside>
  );
}
