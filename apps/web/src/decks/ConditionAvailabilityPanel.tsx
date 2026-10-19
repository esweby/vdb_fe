// Condition availability on the Stats tab (README "Deck analysis", phase two step 7): how
// often what each card's condition needs is in hand with it. Not expected output.
import { useMemo, useState } from "react";
import { runScenarioBatch } from "../ranking/runScenarios.ts";
import { RUNS, type OneOutput } from "../ranking/scenarioRuns.ts";
import { engineCardOf } from "../ranking/scenarios.ts";
import styles from "../scenarios/ScenarioBuilder.module.css";
import { Button } from "../ui/index.ts";
import { availabilityScenarios } from "./conditionAvailability.ts";
import { sectionOf, type DeckEntry } from "./deckRules.ts";

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function ConditionAvailabilityPanel(props: {
  entries: DeckEntry[];
  deckSize: number;
}) {
  const drawn = props.entries.filter(
    (e) => !e.sideboard && sectionOf(e.card) === "deck",
  );
  const signature = JSON.stringify(
    drawn.map((e) => [e.variant.id, e.quantity]).sort(),
  );
  const { scenarios, notMeasured } = useMemo(
    () => availabilityScenarios(props.entries),
    // The signature covers what's drawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );
  const [run, setRun] = useState<{
    outputs: OneOutput[];
    signature: string;
  } | null>(null);
  const [running, setRunning] = useState(false);

  function start() {
    setRunning(true);
    const used = signature;
    runScenarioBatch({
      definitions: scenarios.map((s) => s.definition),
      core: drawn.map((e) => ({
        card: engineCardOf(e.card, e.variant),
        copies: e.quantity,
      })),
      gear: [],
      deckSize: Math.max(
        props.deckSize,
        drawn.reduce((n, e) => n + e.quantity, 0),
      ),
      runs: RUNS,
      seed: 1,
    }).then(
      (outputs) => {
        setRun({ outputs, signature: used });
        setRunning(false);
      },
      () => setRunning(false),
    );
  }

  return (
    <section className={styles.builder} aria-label="Condition availability">
      <header className={styles.head}>
        <div>
          <h2>Condition availability</h2>
          <p>
            When you draw a card with a condition, how often is what the
            condition needs in hand with it? Opening hand of 4, hand only, with
            the card itself in hand, over {RUNS.toLocaleString("en-GB")}{" "}
            shuffles.
          </p>
        </div>
        <Button
          variant="primary"
          disabled={running || scenarios.length === 0}
          onClick={start}
        >
          {running ? "Working it out…" : "Work out availability"}
        </Button>
      </header>
      {scenarios.length === 0 ? (
        <p className={styles.hint}>
          No card in the main deck has a condition a hand can show.
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Card</th>
              <th scope="col">Condition</th>
              <th scope="col">Needs</th>
              <th scope="col">Available</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s, i) => {
              const out = run?.outputs[i];
              return (
                <tr key={`${s.cardName}|${s.condition}`}>
                  <th scope="row">{s.cardName}</th>
                  <td>{s.plain}</td>
                  <td>{s.needs}</td>
                  <td>
                    {!out ? (
                      <span className={styles.hint}>–</span>
                    ) : out.result ? (
                      <span className={styles.cellRate}>
                        {pct(out.result.successRate)}
                      </span>
                    ) : (
                      <span className={styles.problem}>{out.error}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {run && run.signature !== signature && (
        <p className={styles.stale}>
          The deck has changed since this was worked out. Work it out again to
          update.
        </p>
      )}
      <p className={styles.hint}>
        This is how often the condition is <strong>available</strong>, not how
        often you'd play the line that meets it: that depends on choices the
        engine doesn't make. Costs and resources aren't counted. Turn 2 with the
        arsenal comes once scenarios have steps. Which conditions a hand can
        show, and what each needs, are a first pass for a player to check.
      </p>
      {notMeasured.length > 0 && (
        <>
          <h3 id="not-measured">Not worked out from a hand</h3>
          <ul aria-labelledby="not-measured" className={styles.hint}>
            {notMeasured.map((m) => (
              <li key={`${m.cardName}|${m.plain}`}>
                {m.cardName}: {m.plain}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
