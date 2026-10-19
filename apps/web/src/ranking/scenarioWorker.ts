// Runs scenarios off the main thread so the page doesn't freeze (README "Running a scenario").
import {
  runAll,
  runMany,
  runOne,
  type ManyInput,
  type OneInput,
  type ScenarioInput,
} from "./scenarioRuns.ts";

self.onmessage = (
  event: MessageEvent<ScenarioInput | OneInput | ManyInput>,
) => {
  const input = event.data;
  self.postMessage(
    "definitions" in input
      ? runMany(input)
      : "definition" in input
        ? runOne(input)
        : runAll(input),
  );
};
