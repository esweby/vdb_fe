import { useMemo, useState } from "react";
import type { CardSummary } from "../cards/cardRepository.ts";
import { runDeckAnalysis } from "../ranking/runScenarios.ts";
import { Button, Tag } from "../ui/index.ts";
import { formatWindow } from "../fablazing/stats.ts";
import { resolveDeck } from "../calibration/resolveDeck.ts";
import type { DeckEntry } from "./deckRules.ts";
import benchmarkData from "./fablazing-viserai-benchmarks.json";
import {
  answerQuestions,
  DEFAULT_ANSWER_TURN,
  FULL_ANALYSIS_RUNS,
  FULL_ANALYSIS_TURNS,
  questions,
  type Answer,
  type FullAnalysisInput,
  type FullAnalysisOutput,
  type ListDifference,
} from "./fullAnalysis.ts";
import styles from "./Decks.module.css";

export interface BenchmarkSnapshot {
  label: string;
  window: {
    startsOn: string;
    endsOn: string;
    exports: number;
    generatedOn: string;
  };
  observedChain: {
    population: number;
    completed: number;
    byDelay: [number, number, number];
  };
  lists: {
    id: string;
    label: string;
    sides: number;
    loadoutSides: number;
    weapons: { copies: number; name: string; pitch: number | null }[];
    equipment: { copies: number; name: string; pitch: number | null }[];
    cards: { copies: number; name: string; pitch: number | null }[];
  }[];
}

const percent = (share: number) => String(Math.round(share * 100)) + "%";
const amount = (mean: number) => String(Math.round(mean * 10) / 10);
const TURNS = Array.from({ length: FULL_ANALYSIS_TURNS }, (_, i) => i + 1);

/** "+3 points (95%: +1 to +5)" or "+1.5 damage (95%: …)". */
function formatDifference(d: ListDifference, kind: Answer["numbers"]["kind"]) {
  if (!d.pairs) return "No games to compare";
  const signed = (x: number) =>
    !Number.isFinite(x)
      ? "?"
      : (x > 0 ? "+" : x < 0 ? "−" : "") +
        (kind === "share"
          ? String(Math.round(Math.abs(x) * 100))
          : amount(Math.abs(x)));
  const unit = kind === "share" ? " points" : " damage";
  return (
    signed(d.difference.difference) +
    unit +
    " (95%: " +
    signed(d.difference.low) +
    " to " +
    signed(d.difference.high) +
    ")"
  );
}

export function FullAnalysisPanel(props: {
  entries: DeckEntry[];
  cards: CardSummary[];
  benchmarks?: BenchmarkSnapshot;
  run?: (input: FullAnalysisInput) => Promise<FullAnalysisOutput>;
}) {
  const benchmarks = props.benchmarks ?? (benchmarkData as BenchmarkSnapshot);
  const run = props.run ?? runDeckAnalysis;
  const prepared = useMemo(() => {
    const player = resolveDeck(
      props.entries
        .filter((entry) => !entry.sideboard)
        .map((entry) => ({
          copies: entry.quantity,
          name: entry.card.name,
          pitch: entry.variant.pitch,
        })),
      props.cards,
    );
    const decks: FullAnalysisInput["decks"] = [
      {
        id: "player",
        label: "This deck",
        source: "player",
        deck: player.deck,
        weapons: player.weapons,
        equipment: player.equipment,
        coverage: {
          modelled: player.coverage.copies.modelled,
          total: player.coverage.copies.total,
          unmodelled: player.coverage.unmodelled,
        },
      },
    ];
    const missing = [...player.missing];
    for (const list of benchmarks.lists) {
      const resolved = resolveDeck(
        [...list.cards, ...list.weapons, ...list.equipment],
        props.cards,
      );
      missing.push(...resolved.missing.map((card) => list.label + ": " + card));
      decks.push({
        id: list.id,
        label: list.label,
        source: "fablazing",
        sides: list.sides,
        deck: resolved.deck,
        weapons: resolved.weapons,
        equipment: resolved.equipment,
        coverage: {
          modelled: resolved.coverage.copies.modelled,
          total: resolved.coverage.copies.total,
          unmodelled: resolved.coverage.unmodelled,
        },
      });
    }
    return { decks, missing };
  }, [benchmarks, props.cards, props.entries]);
  const [output, setOutput] = useState<FullAnalysisOutput | null>(null);
  const [turn, setTurn] = useState(DEFAULT_ANSWER_TURN);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setRunning(true);
    setError(null);
    try {
      setOutput(
        await run({
          kind: "full-analysis",
          decks: prepared.decks,
          runs: FULL_ANALYSIS_RUNS,
          turns: FULL_ANALYSIS_TURNS,
          seed: 20261027,
        }),
      );
    } catch {
      setError("The analysis stopped. Try it again.");
    } finally {
      setRunning(false);
    }
  }

  const answers = output
    ? answerQuestions(output, turn, benchmarks.observedChain)
    : null;
  const stated =
    answers ??
    questions(
      turn,
      props.entries.filter((e) => !e.sideboard).map((e) => e.card.name),
    );
  const failed = output
    ? output.rows.map((row) => ({
        label: row.label,
        count: row.runs.filter((run) => !run.completed).length,
      }))
    : [];
  return (
    <section aria-label="Full analysis" className={styles.fullAnalysis}>
      <header className={styles.analysisHeading}>
        <div>
          <h2>Full analysis</h2>
          <p>
            Questions about how this deck plays, answered from practice games
            and compared with three common Viserai lists from real games (
            {formatWindow(benchmarks.window.startsOn, benchmarks.window.endsOn)}
            ).
          </p>
        </div>
        <Tag tone="neutral">UNVERIFIED</Tag>
      </header>
      <div className={styles.analysisControls}>
        <Button
          variant="primary"
          disabled={running || prepared.missing.length > 0}
          onClick={() => void start()}
        >
          {running ? "Running…" : output ? "Run again" : "Run analysis"}
        </Button>
        <label className={styles.analysisTurn}>
          By turn
          <select
            value={turn}
            onChange={(event) => setTurn(Number(event.target.value))}
          >
            {TURNS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <p className={styles.analysisNote}>
          {FULL_ANALYSIS_RUNS.toLocaleString()} practice games per deck, in your
          browser; about half a minute. No opponent: nothing is blocked and no
          damage is taken.
        </p>
      </div>
      {prepared.missing.length > 0 && (
        <p role="alert">
          Analysis data is missing: {prepared.missing.join(", ")}.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <ol className={styles.analysisQuestions} aria-busy={running}>
        {stated.map((q, i) => {
          const a = answers?.[i];
          return (
            <li key={q.id}>
              <h3>{q.question}</h3>
              {a ? (
                <>
                  <p className={styles.analysisAnswer}>{a.answer}</p>
                  {a.comparison && <p>{a.comparison}</p>}
                  {a.notes.map((note) => (
                    <p key={note} className={styles.analysisNote}>
                      {note}
                    </p>
                  ))}
                </>
              ) : (
                <p className={styles.analysisNote}>
                  {running ? "Working it out…" : "Run the analysis to answer."}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {answers && output && (
        <>
          <details className={styles.analysisDetails}>
            <summary>Show the numbers</summary>
            {answers.map((a) => (
              <div key={a.id} className={styles.analysisTable}>
                <table>
                  <caption>{a.numbers.caption}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Deck</th>
                      {TURNS.map((t) => (
                        <th scope="col" key={t}>
                          {t}
                        </th>
                      ))}
                      <th scope="col">Difference by turn {turn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.numbers.rows.map((row) => {
                      const diff = a.differences.find(
                        (d) => d.label === row.label,
                      );
                      return (
                        <tr key={row.label}>
                          <th scope="row">{row.label}</th>
                          {row.values.map((value, t) => (
                            <td key={t}>
                              {value === null
                                ? "—"
                                : a.numbers.kind === "share"
                                  ? percent(value)
                                  : amount(value)}
                            </td>
                          ))}
                          <td>
                            {diff
                              ? formatDifference(diff, a.numbers.kind)
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
            <p className={styles.analysisNote}>
              Difference is this deck minus the list, over games both finished
              with the same shuffles. Where the 95% range includes 0 there’s no
              clear difference.
            </p>
          </details>
          <details className={styles.analysisDetails}>
            <summary>How this was worked out</summary>
            <ul>
              <li>
                Each deck plays {output.runs.toLocaleString()} games of{" "}
                {output.turns} turns with the reviewed goldfish play pattern,
                split evenly across the four Cull and Scar answers. Every deck
                gets the same shuffles (seed {output.seed}).
              </li>
              {output.rows.map((row) => (
                <li key={row.id}>
                  {row.label}
                  {row.sides !== undefined &&
                    ` (seen in ${row.sides.toLocaleString()} real games)`}
                  :{" "}
                  {percent(
                    row.coverage.total
                      ? row.coverage.modelled / row.coverage.total
                      : 0,
                  )}{" "}
                  of cards have checked rules.
                  {row.coverage.unmodelled.length > 0 &&
                    ` Not covered: ${row.coverage.unmodelled.join(", ")}.`}
                </li>
              ))}
              {failed.some((f) => f.count > 0) && (
                <li>
                  Games that stopped early and are left out:{" "}
                  {failed
                    .filter((f) => f.count > 0)
                    .map((f) => `${f.label} ${f.count}`)
                    .join(", ")}
                  .
                </li>
              )}
              <li>
                Which turn matters and what counts as good are for you to judge.
              </li>
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
