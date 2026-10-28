// Plan goals (task 7c, docs/plan-goals.md): a scenario and a target success rate on a sideboard
// plan. Both sides of a comparison run on the same seeds, so each run is a pair, and the
// difference carries a 95% interval. An interval that includes 0 (or the target) has no winner.
import {
  buildDeck,
  runScenario,
  ScenarioCannotRun,
  type EngineCard,
  type ScenarioDefinition,
} from "@vdb/engine";
import { wilson } from "../fablazing/stats.ts";

const Z = 1.96;

/** Two sides' outcomes over the same runs: successes on each, and runs only one side won. */
export interface Paired {
  runs: number;
  a: number;
  b: number;
  onlyA: number;
  onlyB: number;
}

export function pairOutcomes(a: boolean[], b: boolean[]): Paired {
  if (a.length !== b.length) throw new Error("Paired runs must line up.");
  const paired = { runs: a.length, a: 0, b: 0, onlyA: 0, onlyB: 0 };
  a.forEach((success, i) => {
    if (success) paired.a++;
    if (b[i]) paired.b++;
    if (success && !b[i]) paired.onlyA++;
    if (!success && b[i]) paired.onlyB++;
  });
  return paired;
}

export interface Difference {
  difference: number;
  low: number;
  high: number;
}

/** A's rate minus B's, with the 95% interval for paired proportions. */
export function pairedDifference(p: Paired, z = Z): Difference {
  const n = p.runs;
  const difference = (p.onlyA - p.onlyB) / n;
  const se =
    Math.sqrt(Math.max(0, p.onlyA + p.onlyB - (p.onlyA - p.onlyB) ** 2 / n)) /
    n;
  return {
    difference,
    low: Math.max(-1, difference - z * se),
    high: Math.min(1, difference + z * se),
  };
}

export type DifferenceVerdict = "higher" | "lower" | "no clear difference";

export function differenceVerdict(d: Difference): DifferenceVerdict {
  if (d.low > 0) return "higher";
  if (d.high < 0) return "lower";
  return "no clear difference";
}

export type GoalVerdict = "met" | "not met" | "no clear answer";

/** A measured rate against its target (0–1), using the rate's 95% Wilson interval. */
export function goalVerdict(successes: number, runs: number, target: number) {
  const { low, high } = wilson(successes, runs);
  const verdict: GoalVerdict =
    low > target ? "met" : high < target ? "not met" : "no clear answer";
  return { rate: successes / runs, low, high, verdict };
}

export interface GoalDeck {
  core: { card: EngineCard; copies: number }[];
  gear: EngineCard[];
  deckSize: number;
}

export interface GoalsInput {
  kind: "plan-goals";
  /** `gear: false` leaves out weapons and equipment, as the built-in scenarios run. */
  goals: { key: string; definition: ScenarioDefinition; gear?: boolean }[];
  /** The plan (side A) and what it's compared with (side B): the main deck or another plan. */
  plan: GoalDeck;
  other: GoalDeck;
  runs: number;
  seed: number;
}

export interface GoalOutput {
  key: string;
  paired?: Paired;
  /** Why the scenario can't run on one of the decks. */
  error?: string;
}

function outcomes(
  goal: GoalsInput["goals"][number],
  side: GoalDeck,
  input: GoalsInput,
) {
  const results: boolean[] = [];
  const gear = goal.gear === false ? [] : side.gear;
  runScenario(goal.definition, buildDeck(side.core, side.deckSize, gear), {
    runs: input.runs,
    seed: input.seed,
    onRun: (success) => results.push(success),
  });
  return results;
}

export function runGoals(input: GoalsInput): GoalOutput[] {
  return input.goals.map((goal) => {
    const { key } = goal;
    try {
      return {
        key,
        paired: pairOutcomes(
          outcomes(goal, input.plan, input),
          outcomes(goal, input.other, input),
        ),
      };
    } catch (e) {
      if (e instanceof ScenarioCannotRun) return { key, error: e.message };
      throw e;
    }
  });
}
