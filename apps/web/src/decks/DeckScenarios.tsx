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
export function DeckScenarios(props: { deckId: string; entries: DeckEntry[] }) {
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
      <p className={styles.preview}>
        Build a scenario of your own, or run the built-in ones from Build a
        core. Runs use the main deck as built.
      </p>
      <SavedScenarios
        deckId={props.deckId}
        entries={props.entries}
        deck={forBuilder}
      />
      <RulesPanel entries={props.entries} />
      <ScenariosPanel
        source="deck"
        output={run?.output ?? null}
        stale={!!run && run.signature !== signature}
        running={running}
        onRun={start}
      />
      {run && <TraverseTimeline output={run.output} />}
    </div>
  );
}
