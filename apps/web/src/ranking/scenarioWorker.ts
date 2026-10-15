// Runs scenarios off the main thread so the page doesn't freeze (README "Running a scenario").
import { runAll, type ScenarioInput } from "./scenarioRuns.ts";

self.onmessage = (event: MessageEvent<ScenarioInput>) => {
  self.postMessage(runAll(event.data));
};
