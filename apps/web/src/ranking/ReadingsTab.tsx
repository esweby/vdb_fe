import { balance, ENGINES, type CoreCard } from "./engines.ts";
import type { ScenarioOutput } from "./scenarioRuns.ts";
import { ScenariosPanel, TraverseTimeline } from "./ScenariosPanel.tsx";
import styles from "./RankingPage.module.css";

/** Readings: what the core does. Scenarios, the traverse timeline and each engine's balance. */
export function ReadingsTab(props: {
  cards: CoreCard[];
  output: ScenarioOutput | null;
  stale: boolean;
  running: boolean;
  onRun: (seed: number) => void;
}) {
  // Only engines with cards in the core, so an empty core isn't a wall of zeros.
  const weighed = ENGINES.map((e) => ({
    e,
    b: balance(props.cards, e.id),
  })).filter(({ b }) => b.generators + b.payoffs > 0);
  return (
    <div className={styles.readings}>
      <ScenariosPanel
        output={props.output}
        stale={props.stale}
        running={props.running}
        onRun={props.onRun}
      />
      {props.output && <TraverseTimeline output={props.output} />}
      <section className={styles.formCard} aria-labelledby="read-engines">
        <header>
          <h2 id="read-engines">Engines</h2>
          <p>
            Copies that make each engine's resource, against copies that use it.
          </p>
        </header>
        {weighed.length === 0 && (
          <p className={styles.none}>
            Add cards to see how each engine balances.
          </p>
        )}
        {weighed.map(({ e, b }) => {
          const gap =
            e.noPayoffs && b.generators > 0 && b.payoffs === 0
              ? e.noPayoffs
              : b.payoffs > 0 && b.generators === 0
                ? e.noGenerators
                : null;
          return (
            <div
              key={e.id}
              role="group"
              aria-label={e.name}
              className={styles.balance}
            >
              <span className={styles.balanceName}>{e.name}</span>
              <span className={styles.balanceRow}>
                <span>
                  {b.generators} {e.makeWord}
                </span>
                <span className={styles.pips} aria-hidden="true">
                  {Array.from(
                    { length: Math.min(b.generators, 16) },
                    (_, i) => (
                      <i key={`g${i}`} />
                    ),
                  )}
                  {e.useWord && <span className={styles.pipGap} />}
                  {Array.from({ length: Math.min(b.payoffs, 16) }, (_, i) => (
                    <i key={`p${i}`} data-payoff="" />
                  ))}
                </span>
                {e.useWord && (
                  <span>
                    {b.payoffs} {e.useWord}
                  </span>
                )}
              </span>
              {gap && <span className={styles.gap}>{gap}</span>}
            </div>
          );
        })}
      </section>
    </div>
  );
}
