import { useState } from "react";
import { runScenarios } from "../ranking/runScenarios.ts";
import { RUNS, type ScenarioOutput } from "../ranking/scenarioRuns.ts";
import { engineCardOf } from "../ranking/scenarios.ts";
import {
  ScenariosPanel,
  TraverseTimeline,
} from "../ranking/ScenariosPanel.tsx";
import { sectionOf, type DeckEntry } from "./deckRules.ts";
import styles from "./Decks.module.css";

/**
 * The Ranking page's scenarios, run against a deck's main deck: a preview of the deck testing
 * still to come (maintainer, 16 Oct 2026). Weapons, equipment and the sideboard aren't drawn.
 */
export function DeckScenarios(props: {
  entries: DeckEntry[];
  deckSize: number;
}) {
  const drawn = props.entries.filter(
    (e) => !e.sideboard && sectionOf(e.card) === "deck",
  );
  // What a run used, so a later change to the deck can be spotted.
  const signature = JSON.stringify(
    drawn.map((e) => [e.variant.id, e.quantity]).sort(),
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
      deckSize: Math.max(
        props.deckSize,
        drawn.reduce((n, e) => n + e.quantity, 0),
      ),
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
        <strong>A preview.</strong> These are the built-in scenarios from Build
        a core, run on this deck. Saved scenarios, fixed cards and turn-by-turn
        play are still to come.
      </p>
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
