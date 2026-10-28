import { useMemo, useState } from "react";
import type { CardSummary } from "../cards/cardRepository.ts";
import { runDeckAnalysis } from "../ranking/runScenarios.ts";
import { Tag } from "../ui/index.ts";
import { resolveDeck } from "../calibration/resolveDeck.ts";
import type { DeckEntry } from "./deckRules.ts";
import benchmarkData from "./fablazing-viserai-benchmarks.json";
import {
  FULL_ANALYSIS_RUNS,
  FULL_ANALYSIS_TURNS,
  type FullAnalysisInput,
  type FullAnalysisOutput,
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

  const observedSameTurn =
    benchmarks.observedChain.byDelay[0] / benchmarks.observedChain.completed;
  return (
    <section aria-label="Full analysis" className={styles.fullAnalysis}>
      <div className={styles.analysisHeading}>
        <div>
          <h2>Full analysis</h2>
          <p>
            Compare this deck's goldfish setup with three common real Viserai
            lists. No opponent, blocking or incoming damage is simulated.
          </p>
        </div>
        <Tag tone="neutral">UNVERIFIED</Tag>
      </div>
      <p className={styles.analysisNote}>
        Each list gets {FULL_ANALYSIS_RUNS.toLocaleString()} runs over eight
        turns in your browser. The real-game same-turn figure is{" "}
        {(observedSameTurn * 100).toFixed(2)}% (
        {benchmarks.observedChain.completed.toLocaleString()} completed chains);
        use it as context, not a target. The common lists come from{" "}
        {benchmarks.window.startsOn} to {benchmarks.window.endsOn}.
      </p>
      {prepared.missing.length > 0 && (
        <p role="alert">
          Analysis data is missing: {prepared.missing.join(", ")}.
        </p>
      )}
      <button
        type="button"
        disabled={running || prepared.missing.length > 0}
        onClick={() => void start()}
      >
        {running ? "Running full analysis…" : "Full analysis"}
      </button>
      {error && <p role="alert">{error}</p>}
      {output && (
        <div className={styles.analysisResults}>
          <table aria-label="Setup comparison">
            <thead>
              <tr>
                <th scope="col">Deck</th>
                <th scope="col">Rule coverage</th>
                <th scope="col">By turn 4</th>
                <th scope="col">By turn 6</th>
                <th scope="col">By turn 8</th>
                <th scope="col">Typical turn</th>
                <th scope="col">Not set up</th>
                <th scope="col">Same turn</th>
              </tr>
            </thead>
            <tbody>
              {output.rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    {row.label}
                    {row.sides !== undefined && (
                      <small>{row.sides.toLocaleString()} real sides</small>
                    )}
                  </th>
                  <td>
                    {percent(
                      row.coverage.total
                        ? row.coverage.modelled / row.coverage.total
                        : 0,
                    )}{" "}
                    covered
                    {row.coverage.unmodelled.length > 0 && (
                      <small>
                        Not covered: {row.coverage.unmodelled.join(", ")}
                      </small>
                    )}
                  </td>
                  <td>{percent(row.summary.byTurn[4])}</td>
                  <td>{percent(row.summary.byTurn[6])}</td>
                  <td>{percent(row.summary.byTurn[8])}</td>
                  <td>{row.summary.medianTurn ?? "—"}</td>
                  <td>{percent(row.summary.incompleteByTurn8)}</td>
                  <td>
                    {row.summary.sameTurn === null
                      ? "—"
                      : percent(row.summary.sameTurn)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.analysisNote}>
            <Tag tone="neutral">UNVERIFIED</Tag> “Typical turn” is the median
            among completed chains. “Not set up” includes runs without a full
            BSL → Gate → blood debt chain by turn 8.
          </p>
        </div>
      )}
    </section>
  );
}
