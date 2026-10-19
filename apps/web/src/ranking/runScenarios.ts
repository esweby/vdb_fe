import {
  runAll,
  runOne,
  type OneInput,
  type OneOutput,
  type ScenarioInput,
  type ScenarioOutput,
} from "./scenarioRuns.ts";

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
