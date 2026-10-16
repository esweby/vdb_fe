import { Button } from "../ui/index.ts";
import type { ScenarioOutput } from "./scenarioRuns.ts";
import { BUILT_IN_SCENARIOS } from "./scenarios.ts";
import styles from "./RankingPage.module.css";

const pct = (x: number) => `${Math.round(x * 100)}%`;
/** Success rates to a tenth of a percent, so a new seed's small differences show. */
const rate = (x: number) => `${(x * 100).toFixed(1)}%`;
const n = (x: number) => x.toLocaleString("en-GB");

/** The built-in scenarios, run together with one button (README "Running a scenario"). */
export function ScenariosPanel(props: {
  output: ScenarioOutput | null;
  /** What's shuffled: a core on the Ranking page, or a deck's main deck. */
  source?: "core" | "deck";
  stale: boolean;
  running: boolean;
  onRun: (seed: number) => void;
}) {
  const { output } = props;
  const source = props.source ?? "core";
  // Scenarios that need something no card in the core has: listed apart, not as 0%.
  const cantRun = output?.scenarios.filter((s) => s.missing) ?? [];
  return (
    <section
      className={`${styles.formCard} ${styles.wide}`}
      aria-label="Scenarios"
    >
      <header className={styles.cardHeadRow}>
        <div>
          <h2>Scenarios</h2>
          <p>
            Shuffles your {source} thousands of times and checks each scenario.
            They count what's in hand; they don't play the game.
          </p>
        </div>
        <div className={styles.runButtons}>
          {output && (
            <Button
              disabled={props.running}
              onClick={() => props.onRun(output.seed + 1)}
            >
              New seed
            </Button>
          )}
          <Button
            variant="primary"
            disabled={props.running}
            onClick={() => props.onRun(output?.seed ?? 1)}
          >
            {props.running ? "Running…" : "Run scenarios"}
          </Button>
        </div>
      </header>
      {output && (
        <p className={styles.runInfo}>
          {`${n(output.runs)} runs each · seed ${output.seed} · ${output.deck.coreCards} ${source} cards + ${output.deck.blanks} blanks (${output.deck.deckSize})`}
        </p>
      )}
      {props.stale && (
        <p className={styles.stale}>
          Your core has changed since this run. Run again to update.
        </p>
      )}
      <ul className={styles.scenarioList} aria-label="Results">
        {BUILT_IN_SCENARIOS.map(({ definition }) => {
          const r = output?.scenarios.find((s) => s.name === definition.name);
          if (r?.missing) return null;
          const top = r?.result?.failures[0];
          return (
            <li key={definition.name} aria-label={definition.name}>
              <span className={styles.scenarioName}>{definition.name}</span>
              {!r ? (
                <span className={styles.notRun}>Not run yet</span>
              ) : (
                <>
                  <span className={styles.rate}>
                    {rate(r.result!.successRate)}
                  </span>
                  {r.result!.byTurn.length > 0 && (
                    <span
                      className={styles.byTurn}
                      role="img"
                      aria-label={r
                        .result!.byTurn.map(
                          (p, i) => `turn ${i + 1}: ${pct(p)}`,
                        )
                        .join(", ")}
                    >
                      {r.result!.byTurn.map((p, i) => (
                        <i
                          key={i}
                          style={{ height: `${Math.max(p * 100, 4)}%` }}
                        />
                      ))}
                    </span>
                  )}
                  <span className={styles.why}>
                    {!top
                      ? "Every run passed."
                      : top.share === 1
                        ? `Fails without ${top.label}`
                        : `Most often missing ${top.label} (${pct(top.share)} of failed runs)`}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {cantRun.length > 0 && (
        <div className={styles.cantRun}>
          <h3 id="cant-run">Can't run with this core</h3>
          <ul aria-labelledby="cant-run">
            {cantRun.map((s) => (
              <li key={s.name} aria-label={s.name}>
                {s.name}: needs {s.missing}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className={styles.hint}>
        A hand of 4 (Viserai's intellect), drawn from the {source} plus blanks
        up to the deck size. Built-in scenarios are a first pass for the scoring
        group to check.
      </p>
    </section>
  );
}

/** Forsaken → Usurper → back, turn by turn, from the Viserai traverse rule set. */
export function TraverseTimeline(props: { output: ScenarioOutput }) {
  const { met, unmet } = props.output.traverse;
  const turns = met.reachedUsurper.length;
  const W = 640;
  const H = 200;
  const L = 40;
  const R = 12;
  const T = 10;
  const B = 28;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(turns - 1, 1);
  const y = (p: number) => T + (1 - p) * (H - T - B);
  const line = (ps: number[]) =>
    ps
      .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`)
      .join("");
  const band =
    line(met.reachedUsurper) +
    unmet.reachedUsurper
      .map((p, i) => [i, p] as const)
      .reverse()
      .map(([i, p]) => `L${x(i).toFixed(1)},${y(p).toFixed(1)}`)
      .join("") +
    "Z";
  return (
    <section
      className={`${styles.formCard} ${styles.wide}`}
      aria-label="Traverse timeline"
    >
      <header>
        <h2>Traverse timeline</h2>
        <p>
          Viserai starts on Forsaken. Creating 3 Runechants in a turn flips you
          to Usurper; on Usurper, creating a Gate flips you back.
        </p>
      </header>
      <div className={styles.facts}>
        <span className={styles.fact}>
          <b>
            {met.averageFirstFlip
              ? `Turn ${met.averageFirstFlip.toFixed(1)}`
              : "–"}
          </b>
          <span>average first flip to Usurper</span>
        </span>
        <span className={styles.fact}>
          <b>{pct(met.reachedUsurper[Math.min(2, turns - 1)]!)}</b>
          <span>on Usurper by turn 3</span>
        </span>
        <span className={styles.fact}>
          <b>{pct(met.neverReached)}</b>
          <span>{`never reach Usurper in ${turns} turns`}</span>
        </span>
        <span className={styles.fact}>
          <b>{pct(met.flippedBack[turns - 1]!)}</b>
          <span>{`flip back by turn ${turns}`}</span>
        </span>
      </div>
      <div className={styles.chartWrap}>
        <svg
          className={styles.chart}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`On Usurper by ${met.reachedUsurper
            .map((p, i) => `turn ${i + 1}: ${pct(p)}`)
            .join(", ")}`}
        >
          {[0, 0.5, 1].map((p) => (
            <g key={p}>
              <line
                className={styles.gridLine}
                x1={L}
                x2={W - R}
                y1={y(p)}
                y2={y(p)}
              />
              <text x={L - 6} y={y(p) + 4} textAnchor="end">
                {pct(p)}
              </text>
            </g>
          ))}
          {met.reachedUsurper.map((_, i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle">
              {`Turn ${i + 1}`}
            </text>
          ))}
          <path className={styles.chartBand} d={band} />
          <path className={styles.chartLine} d={line(met.reachedUsurper)} />
          <path className={styles.chartBack} d={line(met.flippedBack)} />
        </svg>
      </div>
      <p className={styles.legend}>
        <span data-key="usurper">
          Reached Usurper (shaded: no conditions met to all met)
        </span>
        <span data-key="back">Flipped back to Forsaken</span>
      </p>
      <p className={styles.hint}>
        Unverified rule set: a fresh hand of 4 each turn; costs, pitching and
        the arsenal aren't modelled, and using an existing Gate isn't counted.
      </p>
    </section>
  );
}
