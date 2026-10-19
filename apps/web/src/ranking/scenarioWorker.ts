// Runs scenarios off the main thread so the page doesn't freeze (README "Running a scenario").
import {
  runAll,
  runOne,
  type OneInput,
  type ScenarioInput,
} from "./scenarioRuns.ts";

self.onmessage = (event: MessageEvent<ScenarioInput | OneInput>) => {
  const input = event.data;
  self.postMessage("definition" in input ? runOne(input) : runAll(input));
};
