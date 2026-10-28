import {
  runAll,
  runMany,
  runOne,
  runRules,
  type ManyInput,
  type RulesInput,
  type RulesOutput,
  type OneInput,
  type OneOutput,
  type ScenarioInput,
  type ScenarioOutput,
} from "./scenarioRuns.ts";
import {
  runFullAnalysis,
  type FullAnalysisInput,
  type FullAnalysisOutput,
} from "../decks/fullAnalysis.ts";
import {
  runGoals,
  type GoalOutput,
  type GoalsInput,
} from "../decks/planGoals.ts";

/** In a Web Worker where the browser has them; in the page otherwise (tests). */
function inWorker<I, O>(input: I, here: (input: I) => O): Promise<O> {
  if (typeof Worker === "undefined") return Promise.resolve(here(input));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./scenarioWorker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<O>) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (e) => {
      reject(new Error(e.message));
      worker.terminate();
    };
    worker.postMessage(input);
  });
}

/** The built-in scenarios and the traverse timeline. */
export function runScenarios(input: ScenarioInput): Promise<ScenarioOutput> {
  return inWorker(input, runAll);
}

/** One scenario of the user's. */
export function runScenario(input: OneInput): Promise<OneOutput> {
  return inWorker(input, runOne);
}

/** Several scenarios on one deck. */
export function runScenarioBatch(input: ManyInput): Promise<OneOutput[]> {
  return inWorker(input, runMany);
}

/** A deck played by the rules engine. */
export function runByTheRules(input: RulesInput): Promise<RulesOutput> {
  return inWorker(input, runRules);
}

/** The deck-page comparison, using the same worker as scenarios. */
export function runDeckAnalysis(
  input: FullAnalysisInput,
): Promise<FullAnalysisOutput> {
  return inWorker(input, runFullAnalysis);
}

/** A sideboard plan's goals, paired run by run with the main deck or another plan. */
export function runPlanGoals(input: GoalsInput): Promise<GoalOutput[]> {
  return inWorker(input, runGoals);
}
