import { useMemo, useState } from "react";
import { runScenarios } from "../ranking/runScenarios.ts";
import { RUNS, type ScenarioOutput } from "../ranking/scenarioRuns.ts";
import { engineCardOf } from "../ranking/scenarios.ts";
import {
  ScenariosPanel,
  TraverseTimeline,
} from "../ranking/ScenariosPanel.tsx";
import { SavedScenarios } from "../scenarios/SavedScenarios.tsx";
import { scenarioDeck } from "../scenarios/scenarioDeck.ts";
import { RulesPanel } from "../scenarios/RulesPanel.tsx";
import { sectionOf, type DeckEntry } from "./deckRules.ts";
import styles from "./Decks.module.css";

/**
 * Scenarios on a deck: build your own (phase two step 6), and the Ranking page's built-ins run
 * against the main deck as built (no blanks). Weapons and equipment aren't drawn; the sideboard
 * isn't used.
 */
export type ScenarioMode = "run" | "create";

export function DeckScenarios(props: {
  deckId: string;
  entries: DeckEntry[];
  /** Running scenarios, or creating one (the maintainer, 20 Oct 2026). */
  mode: ScenarioMode;
  onMode: (mode: ScenarioMode) => void;
}) {
  const drawn = props.entries.filter(
    (e) => !e.sideboard && sectionOf(e.card) === "deck",
  );
  // What a run used, so a later change to the deck can be spotted.
  const signature = JSON.stringify(
    drawn.map((e) => [e.variant.id, e.quantity]).sort(),
  );
  const deckSize = drawn.reduce((n, e) => n + e.quantity, 0);
  const forBuilder = useMemo(
    () => scenarioDeck(props.entries),
    // The signature covers what's drawn; the weapons and equipment are cheap to redo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      signature,
      JSON.stringify(
        props.entries.map((e) => [e.variant.id, e.quantity, e.sideboard]),
      ),
    ],
  );
  const [run, setRun] = useState<{
    output: ScenarioOutput;
    signature: string;
  } | null>(null);
  const [running, setRunning] = useState(false);

  function start(seed: number) {
    setRunning(true);
    const used = signature;
    runScenarios({
      core: drawn.map((e) => ({
        card: engineCardOf(e.card, e.variant),
        copies: e.quantity,
      })),
      deckSize,
      runs: RUNS,
      seed,
    }).then(
      (output) => {
        setRun({ output, signature: used });
        setRunning(false);
      },
      () => setRunning(false),
    );
  }

  return (
    <div className={styles.scenarios}>
      <div
        role="group"
        aria-label="Scenarios: run or create"
        className={styles.modeToggle}
      >
        {(
          [
            ["run", "Run"],
            ["create", "Create"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={props.mode === mode}
            onClick={() => props.onMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className={styles.preview}>
        {props.mode === "run"
          ? "Run your scenarios, the library's and the built-ins on this deck. Runs use the main deck as built, or the matchup being played."
          : "Build a scenario: a question about this deck's hands, checked over thousands of shuffles. Run it here to try it, then save it to add it to your scenarios."}
      </p>
      <SavedScenarios
        deckId={props.deckId}
        entries={props.entries}
        deck={forBuilder}
        mode={props.mode}
        onMode={props.onMode}
      />
      {props.mode === "run" && (
        <>
          <RulesPanel entries={props.entries} />
          <ScenariosPanel
            source="deck"
            output={run?.output ?? null}
            stale={!!run && run.signature !== signature}
            running={running}
            onRun={start}
          />
          {run && <TraverseTimeline output={run.output} />}
        </>
      )}
    </div>
  );
}
