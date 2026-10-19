// Runs scenarios off the main thread so the page doesn't freeze (README "Running a scenario").
import {
  runAll,
  runMany,
  runOne,
  runRules,
  type ManyInput,
  type OneInput,
  type RulesInput,
  type ScenarioInput,
} from "./scenarioRuns.ts";

type Input = ScenarioInput | OneInput | ManyInput | RulesInput;

function run(input: Input) {
  if ("kind" in input) return runRules(input);
  if ("definitions" in input) return runMany(input);
  if ("definition" in input) return runOne(input);
  return runAll(input);
}

self.onmessage = (event: MessageEvent<Input>) => {
  self.postMessage(run(event.data));
};
