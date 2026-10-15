import {
  runAll,
  type ScenarioInput,
  type ScenarioOutput,
} from "./scenarioRuns.ts";

/** In a Web Worker where the browser has them; in the page otherwise (tests). */
export function runScenarios(input: ScenarioInput): Promise<ScenarioOutput> {
  if (typeof Worker === "undefined") return Promise.resolve(runAll(input));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./scenarioWorker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<ScenarioOutput>) => {
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
