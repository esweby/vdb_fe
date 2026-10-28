// UNVERIFIED deck comparison. It runs the current reviewed goldfish policy with no opponent.
import type { RulesCard } from "@vdb/engine/rules";
import { BLOOD_DEBT, RUNECHANT, VISERAI } from "@vdb/engine/rules";
import { runGateWeaponBatch } from "../calibration/gateWeaponBatch.ts";

export const FULL_ANALYSIS_RUNS = 1_000;
export const FULL_ANALYSIS_TURNS = 8;

export interface ChainRun {
  completed: boolean;
  setupTurn: number | null;
  payoffTurn: number | null;
}

export interface SetupSummary {
  completedRuns: number;
  failedRuns: number;
  byTurn: Record<4 | 6 | 8, number>;
  medianTurn: number | null;
  incompleteByTurn8: number;
  sameTurn: number | null;
  chains: number;
}

export function summariseChainRuns(runs: ChainRun[]): SetupSummary {
  const completed = runs.filter((run) => run.completed);
  const payoffTurns = completed
    .flatMap((run) => (run.payoffTurn === null ? [] : [run.payoffTurn]))
    .sort((a, b) => a - b);
  const at = (turn: 4 | 6 | 8) =>
    completed.length
      ? payoffTurns.filter((payoff) => payoff <= turn).length / completed.length
      : 0;
  const middle = Math.floor(payoffTurns.length / 2);
  const medianTurn = payoffTurns.length
    ? payoffTurns.length % 2
      ? payoffTurns[middle]!
      : (payoffTurns[middle - 1]! + payoffTurns[middle]!) / 2
    : null;
  const sameTurn = payoffTurns.length
    ? completed.filter(
        (run) => run.payoffTurn !== null && run.payoffTurn === run.setupTurn,
      ).length / payoffTurns.length
    : null;
  return {
    completedRuns: completed.length,
    failedRuns: runs.length - completed.length,
    byTurn: { 4: at(4), 6: at(6), 8: at(8) },
    medianTurn,
    incompleteByTurn8: completed.length
      ? completed.filter((run) => run.payoffTurn === null || run.payoffTurn > 8)
          .length / completed.length
      : 0,
    sameTurn,
    chains: payoffTurns.length,
  };
}

export interface AnalysisDeckInput {
  id: string;
  label: string;
  source: "player" | "fablazing";
  sides?: number;
  deck: RulesCard[];
  weapons: RulesCard[];
  equipment: RulesCard[];
  coverage: {
    modelled: number;
    total: number;
    unmodelled: string[];
  };
}

export interface FullAnalysisInput {
  kind: "full-analysis";
  decks: AnalysisDeckInput[];
  runs: number;
  seed: number;
  turns: number;
}

export interface AnalysisRow {
  id: string;
  label: string;
  source: AnalysisDeckInput["source"];
  sides?: number;
  coverage: AnalysisDeckInput["coverage"];
  summary: SetupSummary;
}

export interface FullAnalysisOutput {
  rows: AnalysisRow[];
  runs: number;
  seed: number;
  turns: number;
  policy: "reviewed-delayed-hands-v2";
}

/** The same four explicit Cull and Scar answers used by the T5 investigation. */
export function analysisCases(runs: number, seed: number) {
  const answers = [
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ] as const;
  return answers
    .map(([lostLife, lessLife], index) => ({
      runs:
        Math.floor(runs / answers.length) +
        (index < runs % answers.length ? 1 : 0),
      seed: seed + index * 1_000_003,
      choices: {
        conditions: {
          hero_lost_life_this_turn: lostLife,
          less_life_than_opposing_hero: lessLife,
        },
      },
    }))
    .filter((item) => item.runs > 0);
}

export function runFullAnalysis(input: FullAnalysisInput): FullAnalysisOutput {
  return {
    rows: input.decks.map((deck) => {
      const runs = analysisCases(input.runs, input.seed).flatMap(
        (item) =>
          runGateWeaponBatch(
            {
              deck: deck.deck,
              weapons: deck.weapons,
              equipment: deck.equipment,
              side: "forsaken",
              triggers: [...VISERAI, RUNECHANT, BLOOD_DEBT],
            },
            {
              ...item,
              turns: input.turns,
              mode: "both",
              startingLife: 40,
              decisions: { traverseBack: true },
              measureBslGateBloodDebt: true,
            },
          ).perRun,
      );
      return {
        id: deck.id,
        label: deck.label,
        source: deck.source,
        ...(deck.sides === undefined ? {} : { sides: deck.sides }),
        coverage: deck.coverage,
        summary: summariseChainRuns(
          runs.map((run) => ({
            completed: run.completed,
            setupTurn: run.bslGateBloodDebt?.setupTurn ?? null,
            payoffTurn: run.bslGateBloodDebt?.payoffTurn ?? null,
          })),
        ),
      };
    }),
    runs: input.runs,
    seed: input.seed,
    turns: input.turns,
    policy: "reviewed-delayed-hands-v2",
  };
}
